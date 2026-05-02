import { useState, useRef, useEffect } from 'react';
import { getNextId } from '../utils/storage';

const DIRS4 = [
  { key: 'north', label: 'צפון' },
  { key: 'east',  label: 'מזרח' },
  { key: 'south', label: 'דרום' },
  { key: 'west',  label: 'מערב' },
];
const DIRS3 = [
  { key: 'north', label: 'צפון' },
  { key: 'east',  label: 'מזרח' },
  { key: 'south', label: 'דרום' },
];
const SIGNS = ['301', '303', '306', '214', '213'];
const STATUSES = ['תקין', 'לא תקין', 'חסר'];

function buildCards(type) {
  const dirs = type === '3' ? DIRS3 : DIRS4;
  return dirs.flatMap(d =>
    SIGNS.map(sign => ({ dirKey: d.key, dirLabel: d.label, sign, status: '', photo: null }))
  );
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function getGPS(fallbackLat, fallbackLon) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: fallbackLat || '', lon: fallbackLon || '' }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude.toFixed(6),
        lon: pos.coords.longitude.toFixed(6),
      }),
      () => resolve({ lat: fallbackLat || '', lon: fallbackLon || '' }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function SignImg({ sign }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="rb-wiz-sign-fallback">{sign}</div>;
  return (
    <img src={`/signs/${sign}.png`} className="rb-wiz-sign-img" alt={sign}
      onError={() => setBroken(true)} />
  );
}

export default function RoundaboutWizard({ open, onClose, address, lat, lon, onSavedBatch, openLightbox, showToast, initialMode = 'cards' }) {
  // shared
  const [wizMode, setWizMode]   = useState(initialMode); // 'cards' | 'rapid'

  // cards mode
  const [rbType, setRbType]       = useState('4');
  const [cards, setCards]         = useState(() => buildCards('4'));
  const [idx, setIdx]             = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const fileInputRef              = useRef(null);

  // rapid mode
  const [rapidShots, setRapidShots] = useState([]); // [{photo, lat, lon}]
  const rapidFileRef  = useRef(null);
  const pendingGpsRef = useRef(null);

  // sync mode when wizard re-opens with a different initialMode
  useEffect(() => { if (open) setWizMode(initialMode); }, [open, initialMode]);

  if (!open) return null;

  /* ── helpers ── */
  const reset = () => {
    setWizMode('cards');
    setRbType('4');
    setCards(buildCards('4'));
    setIdx(0);
    setShowSummary(false);
    setRapidShots([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const makeTimestamp = () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  /* ── cards mode handlers ── */
  const setCardField = (field, value) =>
    setCards(cs => cs.map((c, i) => i === idx ? { ...c, [field]: value } : c));

  const handleTypeChange = (t) => {
    setRbType(t);
    setCards(buildCards(t));
    setIdx(0);
    setShowSummary(false);
  };

  const handleCardPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setCardField('photo', await compressImage(file));
    } catch {
      showToast?.('❌ לא ניתן לקרוא תמונה.');
    }
  };

  const handleNext = () => {
    if (idx < cards.length - 1) setIdx(i => i + 1);
    else setShowSummary(true);
  };

  const handlePrev = () => {
    if (showSummary) { setShowSummary(false); return; }
    if (idx > 0) setIdx(i => i - 1);
  };

  const handleCardsSave = () => {
    const { date, time } = makeTimestamp();
    const recs = cards
      .filter(c => c.status !== '')
      .map(c => ({
        id: getNextId(),
        address: address || '—',
        lat: lat || '', lon: lon || '',
        notes: '', category: c.status,
        signNumber: c.sign, signDirection: c.dirLabel,
        photos: c.photo ? [c.photo] : [],
        date, time,
      }));
    onSavedBatch(recs);
    reset();
    onClose();
  };

  /* ── rapid mode handlers ── */
  const handleRapidShoot = () => {
    // start GPS fetch immediately — runs in parallel while camera opens
    pendingGpsRef.current = getGPS(lat, lon);
    rapidFileRef.current?.click();
  };

  const handleRapidPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const [photo, gps] = await Promise.all([
        compressImage(file),
        pendingGpsRef.current || getGPS(lat, lon),
      ]);
      pendingGpsRef.current = null;
      setRapidShots(prev => [...prev, { photo, lat: gps.lat, lon: gps.lon }]);
    } catch {
      showToast?.('❌ לא ניתן לקרוא תמונה.');
    }
  };

  const removeRapidShot = (i) =>
    setRapidShots(prev => prev.filter((_, j) => j !== i));

  const handleRapidSave = () => {
    if (!rapidShots.length) return;
    const { date, time } = makeTimestamp();
    const recs = rapidShots.map(s => ({
      id: getNextId(),
      address: address || '—',
      lat: s.lat, lon: s.lon,
      notes: '', category: '',
      signNumber: '', signDirection: '',
      photos: [s.photo],
      date, time,
    }));
    onSavedBatch(recs);
    reset();
    onClose();
  };

  /* ════════════════════════════════════
     RAPID MODE
  ════════════════════════════════════ */
  if (wizMode === 'rapid') {
    return (
      <div className="rb-wiz-overlay">
        <div className="rb-wiz-header">
          <button className="rb-wiz-back" onClick={() => setWizMode('cards')}>‹ כרטיסיות</button>
          <span className="rb-wiz-title">
            צילום רציף{rapidShots.length > 0 ? ` · ${rapidShots.length} תמונות` : ''}
          </span>
          <button className="rb-wiz-close" onClick={handleClose}>✕</button>
        </div>

        <div className="rb-wiz-rapid-body">
          <input
            ref={rapidFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleRapidPhoto}
          />

          <button className="rb-wiz-rapid-shutter" onClick={handleRapidShoot}>
            <span className="rb-wiz-rapid-icon">📷</span>
            <span>צלם תמונה</span>
            <span className="rb-wiz-rapid-sub">המיקום נלכד אוטומטית</span>
          </button>

          {rapidShots.length > 0 && (
            <div className="rb-wiz-rapid-grid">
              {rapidShots.map((s, i) => (
                <div key={i} className="rb-wiz-rapid-item">
                  <img
                    className="rb-wiz-rapid-thumb"
                    src={s.photo}
                    alt={`תמונה ${i + 1}`}
                    onClick={() => openLightbox?.(s.photo)}
                  />
                  {s.lat && <div className="rb-wiz-rapid-gps">📍</div>}
                  <button className="rb-wiz-rapid-remove" onClick={() => removeRapidShot(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rb-wiz-nav">
          <button className="rb-wiz-btn-prev" onClick={() => setWizMode('cards')}>‹ חזרה</button>
          {rapidShots.length > 0 && (
            <button className="rb-wiz-btn-save" onClick={handleRapidSave}>
              שמור {rapidShots.length} רשומות ✅
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     SUMMARY SCREEN
  ════════════════════════════════════ */
  if (showSummary) {
    const filledCount = cards.filter(c => c.status !== '').length;
    const summaryByStatus = STATUSES.map(s => ({
      label: s, count: cards.filter(c => c.status === s).length,
    })).filter(x => x.count > 0);

    return (
      <div className="rb-wiz-overlay">
        <div className="rb-wiz-header">
          <button className="rb-wiz-back" onClick={handlePrev}>‹ חזרה</button>
          <span className="rb-wiz-title">סיכום</span>
          <button className="rb-wiz-close" onClick={handleClose}>✕</button>
        </div>
        <div className="rb-wiz-summary">
          <div className="rb-wiz-sum-count">{filledCount} תמרורים סווגו</div>
          {summaryByStatus.map(({ label, count }) => (
            <div key={label} className="rb-wiz-sum-row">
              <span className="rb-wiz-sum-label">{label}</span>
              <span className="rb-wiz-sum-num">{count}</span>
            </div>
          ))}
          {filledCount === 0 && (
            <div className="rb-wiz-sum-empty">לא סווגו תמרורים — לא תישמר רשומה</div>
          )}
        </div>
        <div className="rb-wiz-nav">
          <button className="rb-wiz-btn-prev" onClick={handlePrev}>‹ חזרה</button>
          <button className="rb-wiz-btn-save" onClick={handleCardsSave} disabled={filledCount === 0}>
            שמור הכל ✅
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     CARD SCREEN
  ════════════════════════════════════ */
  const total = cards.length;
  const card = cards[idx];
  const progress = ((idx + 1) / total) * 100;

  return (
    <div className="rb-wiz-overlay">
      <div className="rb-wiz-header">
        <button className="rb-wiz-back" onClick={idx === 0 ? handleClose : handlePrev}>
          {idx === 0 ? '✕' : '‹ חזרה'}
        </button>
        <span className="rb-wiz-title">כיכר — {idx + 1} / {total}</span>
        <button className="rb-wiz-rapid-toggle" onClick={() => setWizMode('rapid')}>
          📷 רציף
        </button>
      </div>

      <div className="rb-wiz-progress">
        <div className="rb-wiz-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="rb-wiz-card">
        {idx === 0 && (
          <div className="rb-wiz-type-row">
            <button className={`rb-wiz-type-btn${rbType === '4' ? ' active' : ''}`} onClick={() => handleTypeChange('4')}>
              4 כניסות
            </button>
            <button className={`rb-wiz-type-btn${rbType === '3' ? ' active' : ''}`} onClick={() => handleTypeChange('3')}>
              3 כניסות
            </button>
          </div>
        )}

        <div className="rb-wiz-dir">{card.dirLabel}</div>
        <SignImg sign={card.sign} />
        <div className="rb-wiz-sign-num">תמרור {card.sign}</div>

        <div className="rb-wiz-chips">
          {STATUSES.map(s => (
            <button
              key={s}
              className={`rb-wiz-chip${card.status === s ? ' active' : ''}`}
              onClick={() => setCardField('status', card.status === s ? '' : s)}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleCardPhoto}
        />
        {card.photo ? (
          <div className="photo-thumb-wrap">
            <img className="photo-thumb" src={card.photo} alt="תמונה"
              onClick={() => openLightbox?.(card.photo)} />
            <button className="photo-thumb-remove" onClick={() => setCardField('photo', null)} title="הסר">✕</button>
          </div>
        ) : (
          <button className="btn-photo" onClick={() => fileInputRef.current?.click()}>
            📷 צלם / הוסף תמונה
          </button>
        )}
      </div>

      <div className="rb-wiz-nav">
        {idx > 0 && (
          <button className="rb-wiz-btn-prev" onClick={handlePrev}>‹ הקודם</button>
        )}
        <button
          className={idx === total - 1 ? 'rb-wiz-btn-summary' : 'rb-wiz-btn-next'}
          onClick={handleNext}
        >
          {idx === total - 1 ? 'סיכום ✓' : 'הבא ›'}
        </button>
      </div>
    </div>
  );
}
