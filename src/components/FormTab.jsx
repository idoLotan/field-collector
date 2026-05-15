import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import AddressField from './AddressField';
import GpsField from './GpsField';
import NotesField from './NotesField';
import PhotosField from './PhotosField';
import { loadDraft, persistDraft, clearDraft, loadAddrPairs, getNextId } from '../utils/storage';
import SignPicker, { SIGNS } from './SignPicker';
import RoundaboutModal, { EMPTY_RB, hasRbData, formatRbForExcel } from './RoundaboutModal';
import RoundaboutWizard from './RoundaboutWizard';

const gpsMarkerIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 0 0 3px rgba(220,38,38,.35);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/* ── SVG icons ── */
function IconLocation() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 6C24.3 6 18 12.3 18 20c0 11 14 30 14 30S46 31 46 20C46 12.3 39.7 6 32 6z"/>
      <circle cx="32" cy="20" r="5"/>
      <path d="M18 44 L10 48 L10 58 L26 53 L38 58 L54 53 L54 44 L46 48"/>
    </svg>
  );
}
function IconTag() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M35 6H10a4 4 0 0 0-4 4v25l25 25a4 4 0 0 0 5.7 0L56 40.7a4 4 0 0 0 0-5.7L35 6z"/>
      <circle cx="21" cy="21" r="4"/>
    </svg>
  );
}
function IconNotes() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M48 6H16a6 6 0 0 0-6 6v28a6 6 0 0 0 6 6h8l8 12 8-12h8a6 6 0 0 0 6-6V12a6 6 0 0 0-6-6z"/>
      <line x1="22" y1="24" x2="42" y2="24"/>
      <line x1="22" y1="34" x2="36" y2="34"/>
    </svg>
  );
}
function IconCamera() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M56 48a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4h6l5-8h18l5 8h6a4 4 0 0 1 4 4v26z"/>
      <circle cx="32" cy="34" r="10"/>
    </svg>
  );
}

export default function FormTab({ active, onSaved, onSavedBatch, showToast, openLightbox, onGoToMap }) {
  const draft = useMemo(() => loadDraft(), []);

  const [addrMode, setAddrMode]             = useState(draft?.addressMode || 'list');
  const [selectedStreet, setSelectedStreet] = useState(draft?.street || '');
  const [selectedHouse, setSelectedHouse]   = useState(draft?.house || '');
  const [streetInput, setStreetInput]       = useState(draft?.street || '');
  const [freeText, setFreeText]             = useState(draft?.fAddressFree || '');
  const [notes, setNotes]                   = useState(draft?.notes || '');
  const [capturedLat, setCapturedLat]       = useState(draft?.lat || null);
  const [capturedLon, setCapturedLon]       = useState(draft?.lon || null);
  const [stagingPhotos, setStagingPhotos]   = useState(draft?.photos || []);
  const [category, setCategory]             = useState(draft?.category || '');
  const [defect, setDefect]                 = useState(draft?.defect || '');
  const [signNumber, setSignNumber]         = useState(draft?.signNumber || '');
  const [signCode, setSignCode]             = useState(draft?.signCode || '');
  const [signPickerOpen, setSignPickerOpen] = useState(false);
  const [roundabout, setRoundabout]         = useState(draft?.roundabout || null);
  const [wizardOpen, setWizardOpen]           = useState(false);
  const [wizardInitialMode, setWizardInitialMode] = useState('cards');
  const [addrPairs, setAddrPairs]           = useState(() => loadAddrPairs());
  const [formKey, setFormKey]               = useState(0);
  const [step, setStep]                     = useState(null); // null = home

  const viewRef = useRef(null);

  useEffect(() => {
    persistDraft({
      addressMode: addrMode, street: selectedStreet, house: selectedHouse,
      fAddressFree: freeText, notes, lat: capturedLat, lon: capturedLon,
      photos: stagingPhotos, category, defect, signNumber, signCode, roundabout,
    });
  }, [addrMode, selectedStreet, selectedHouse, freeText, notes, capturedLat, capturedLon, stagingPhotos, category, defect, signNumber, signCode, roundabout]);

  useEffect(() => {
    viewRef.current?.scrollTo(0, 0);
  }, [step]);

  const getAddressValue = () => {
    if (addrMode === 'free') return freeText.trim();
    if (!selectedStreet && !selectedHouse) return '';
    if (!selectedHouse) return selectedStreet;
    return `${selectedStreet} ${selectedHouse}`;
  };

  const handleStreetPick = (street) => { setSelectedStreet(street); setStreetInput(street); setSelectedHouse(''); };
  const handleStreetInput = (val) => {
    setStreetInput(val);
    if (val !== selectedStreet) { setSelectedStreet(''); setSelectedHouse(''); }
  };

  const saveRecord = () => {
    const address = getAddressValue();
    const now = new Date();
    const record = {
      id: getNextId(),
      address: address || '—',
      lat: capturedLat || '',
      lon: capturedLon || '',
      notes: notes.trim(),
      category,
      defect,
      signNumber: signNumber.trim(),
      signCode,
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      photos: [...stagingPhotos],
    };
    onSaved(record);
    clearDraft();
    showToast('✅ הרשומה נשמרה!');
    setSelectedStreet(''); setSelectedHouse(''); setStreetInput('');
    setFreeText(''); setNotes(''); setCategory(''); setDefect(''); setSignNumber(''); setSignCode(''); setRoundabout(null);
    setCapturedLat(null); setCapturedLon(null); setStagingPhotos([]);
    setFormKey(k => k + 1);
  };

  /* ── tile summaries ── */
  const addrValue = getAddressValue();
  const addrDone  = !!capturedLat;
  const catDone   = !!category;
  const notesDone = !!notes.trim();
  const photosDone = stagingPhotos.length > 0;

  /* ── GPS capture (inline) ── */
  const [gpsLoading, setGpsLoading] = useState(false);
  const captureGPS = () => {
    if (!navigator.geolocation) { showToast('❌ הדפדפן אינו תומך ב-GPS'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturedLat(pos.coords.latitude.toFixed(6));
        setCapturedLon(pos.coords.longitude.toFixed(6));
        showToast(`✅ מיקום נלכד · דיוק ±${Math.round(pos.coords.accuracy)} מ'`);
        setGpsLoading(false);
      },
      () => { showToast('❌ לא ניתן לאתר מיקום'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /* ── back button ── */
  const Back = () => (
    <button className="step-back" onClick={() => setStep(null)}>
      {'<'} חזרה
    </button>
  );

  /* ════════════════════════════════════════
     HOME — tile grid
  ════════════════════════════════════════ */
  const homeScreen = (
    <>
      <div className="form-home-header">
        <h2>רשומה חדשה</h2>
        <p>בחר קטגוריה להזנת מידע</p>
      </div>

      <div className="form-tiles">
        <button className={`form-tile${addrDone ? ' done' : ''}`} onClick={() => setStep('address')}>
          <span className="form-tile-badge">{addrDone ? '✓' : ''}</span>
          <div className="form-tile-icon"><IconLocation /></div>
          <span className="form-tile-label">מיקום GPS</span>
          <span className="form-tile-sub">{addrDone ? '📍 מיקום נלכד' : ''}</span>
        </button>
        <button className={`form-tile${catDone ? ' done' : ''}`} onClick={() => setStep('category')}>
          <span className="form-tile-badge">{catDone ? '✓' : ''}</span>
          <div className="form-tile-icon"><IconTag /></div>
          <span className="form-tile-label">סיווג</span>
          <span className="form-tile-sub">{catDone ? category : ''}</span>
        </button>
        <button className={`form-tile${notesDone ? ' done' : ''}`} onClick={() => setStep('notes')}>
          <span className="form-tile-badge">{notesDone ? '✓' : ''}</span>
          <div className="form-tile-icon"><IconNotes /></div>
          <span className="form-tile-label">הערות</span>
          <span className="form-tile-sub">{notesDone ? `${notes.slice(0, 22)}${notes.length > 22 ? '…' : ''}` : ''}</span>
        </button>
        <button className={`form-tile${photosDone ? ' done' : ''}`} onClick={() => setStep('photos')}>
          <span className="form-tile-badge">{photosDone ? stagingPhotos.length : ''}</span>
          <div className="form-tile-icon"><IconCamera /></div>
          <span className="form-tile-label">תמונות</span>
          <span className="form-tile-sub">{photosDone ? `${stagingPhotos.length} תמונות` : ''}</span>
        </button>
      </div>

      <button className="btn btn-primary step-save-btn" onClick={saveRecord}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        שמור רשומה
      </button>
    </>
  );

  /* ════════════════════════════════════════
     GPS LOCATION
  ════════════════════════════════════════ */
  const addressScreen = (
    <>
      <div className="step-header">
        <h2>לכידת מיקום GPS</h2>
        <p>לחץ לכידת המיקום הנוכחי</p>
      </div>

      <div className="addr-actions">
        <button className="addr-action-card" onClick={captureGPS} disabled={gpsLoading}>
          <span className="addr-action-icon">
            {gpsLoading
              ? <span className="spin" style={{borderColor:'rgba(29,78,216,.3)',borderTopColor:'var(--blue)'}}/>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <circle cx="12" cy="12" r="8" strokeDasharray="3 3"/>
                </svg>
            }
          </span>
          <span className="addr-action-label">{capturedLat ? '🔄 עדכן מיקום' : '📍 לכוד מיקום'}</span>
        </button>
      </div>

      {capturedLat && (
        <>
          <div className="addr-gps-badge" style={{ marginBottom: 12 }}>
            📍 {capturedLat}, {capturedLon}
            <button onClick={() => { setCapturedLat(null); setCapturedLon(null); }}>✕</button>
          </div>
          <div className="gps-preview-map">
            <MapContainer
              key={`${capturedLat},${capturedLon}`}
              center={[parseFloat(capturedLat), parseFloat(capturedLon)]}
              zoom={17}
              style={{ width: '100%', height: '260px', borderRadius: '14px' }}
              zoomControl={true}
              attributionControl={false}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                position={[parseFloat(capturedLat), parseFloat(capturedLon)]}
                icon={gpsMarkerIcon}
              />
            </MapContainer>
          </div>
        </>
      )}

      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={() => setStep(null)}>המשך</button>
      </div>
    </>
  );

  /* ════════════════════════════════════════
     CATEGORY + SIGN NUMBER
  ════════════════════════════════════════ */
  const categoryScreen = (
    <>
      <div className="step-header">
        <h2>סיווג</h2>
        <p>בחר סטטוס והזן מספר תמרור</p>
      </div>

      <div className="cat-cards">
        <button
          className={`cat-card${category === 'תקין' ? ' active-ok' : ''}`}
          onClick={() => { setCategory(category === 'תקין' ? '' : 'תקין'); setDefect(''); }}
        >
          <span className={`cat-icon${category === 'תקין' ? ' ok' : ''}`}>
            {category === 'תקין' ? '✓' : '○'}
          </span>
          <span className="cat-label">תקין</span>
        </button>
        <button
          className={`cat-card${category === 'לא תקין' ? ' active-bad' : ''}`}
          onClick={() => { const next = category === 'לא תקין' ? '' : 'לא תקין'; setCategory(next); if (!next) setDefect(''); }}
        >
          <span className={`cat-icon${category === 'לא תקין' ? ' bad' : ''}`}>
            {category === 'לא תקין' ? '✕' : '○'}
          </span>
          <span className="cat-label">לא תקין</span>
        </button>
        <button
          className={`cat-card${category === 'תמרור להצבה' ? ' active-new' : ''}`}
          onClick={() => { setCategory(category === 'תמרור להצבה' ? '' : 'תמרור להצבה'); setDefect(''); }}
        >
          <span className={`cat-icon${category === 'תמרור להצבה' ? ' new-sign' : ''}`}>
            {category === 'תמרור להצבה' ? '+' : '○'}
          </span>
          <span className="cat-label">להצבה</span>
        </button>
      </div>

      {category === 'לא תקין' && (
        <div className="defect-chips">
          {['תמרור עקום', 'עמוד עקום', 'תמרור דהוי', 'הזזת תמרור'].map(d => (
            <button
              key={d}
              className={`defect-chip${defect === d ? ' active' : ''}`}
              onClick={() => setDefect(defect === d ? '' : d)}
            >{d}</button>
          ))}
        </div>
      )}

      {/* כיכר — מוסתר זמנית, לא נמחק
      <button
        className={`rb-trigger${hasRbData(roundabout) ? ' rb-trigger-on' : ''}`}
        onClick={() => { if (!roundabout) setRoundabout(EMPTY_RB); setStep('roundabout'); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="4"/>
          <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M19.07 4.93l-4.24 4.24M9.17 14.83l-4.24 4.24"/>
        </svg>
        <span>כיכר — סיווג תמרורים</span>
        {hasRbData(roundabout)
          ? <span className="rb-trigger-badge">✓ הוזן</span>
          : <span className="rb-trigger-arr">›</span>}
      </button>
      */}

      <div className="field">
        <label>סוג תמרור <span>🪧</span></label>
        {signCode ? (
          <div className="sign-selected-row">
            <div className="sign-selected-icon">
              {(() => { const s = SIGNS.find(x => x.code === signCode); return s ? <img src={s.img} alt={signCode} /> : null; })()}
            </div>
            <span className="sign-selected-label">{signCode}</span>
            <button className="sign-change-btn" onClick={() => setSignPickerOpen(true)}>שנה</button>
            <button className="sign-clear-btn" onClick={() => { setSignCode(''); setSignNumber(''); }}>✕</button>
          </div>
        ) : (
          <button className="sign-pick-btn" onClick={() => setSignPickerOpen(true)}>
            לחץ לבחירת סוג תמרור…
          </button>
        )}
      </div>

      <div className="field">
        <label>מס׳ תמרור <span>🔢</span></label>
        <input
          type="text"
          placeholder="הזן מספר תמרור…"
          value={signNumber}
          onChange={e => setSignNumber(e.target.value)}
        />
      </div>

      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={() => setStep(null)}>המשך</button>
      </div>
    </>
  );

  /* ════════════════════════════════════════
     NOTES
  ════════════════════════════════════════ */
  const notesScreen = (
    <>
      <div className="step-header">
        <h2>הערות</h2>
        <p>הוסף הערות לרשומה</p>
      </div>

      <div className="field">
        <NotesField
          key={`notes-${formKey}`}
          notes={notes}
          onChange={setNotes}
          showToast={showToast}
        />
      </div>

      <button className="btn-skip" onClick={() => { setNotes(''); setStep(null); }}>
        ללא הערות
      </button>

      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={saveRecord}>שמור רשומה</button>
      </div>
    </>
  );

  /* ════════════════════════════════════════
     PHOTOS
  ════════════════════════════════════════ */
  const photosScreen = (
    <>
      <div className="step-header">
        <h2>תמונות</h2>
        <p>צלם או הוסף תמונות לרשומה</p>
      </div>

      <PhotosField
        key={`photos-${formKey}`}
        photos={stagingPhotos}
        onChange={setStagingPhotos}
        openLightbox={openLightbox}
        showToast={showToast}
      />

      <button className="btn-skip" onClick={() => { setStagingPhotos([]); setStep(null); }}>
        ללא תמונות
      </button>

      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={() => setStep(null)}>המשך</button>
      </div>
    </>
  );

  /* ════════════════════════════════════════
     ROUNDABOUT SCREEN (inline step)
  ════════════════════════════════════════ */
  const roundaboutScreen = (
    <>
      <div className="step-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>כיכר — סיווג תמרורים</h2>
        <button className="rb-x" onClick={() => setStep('category')}>✕</button>
      </div>
      <RoundaboutModal
        open
        data={roundabout}
        onChange={setRoundabout}
        onClose={() => setStep('category')}
        onSwitchToCards={() => { setStep(null); setWizardInitialMode('cards'); setWizardOpen(true); }}
        onSwitchToRapid={() => { setStep(null); setWizardInitialMode('rapid'); setWizardOpen(true); }}
        lat={capturedLat}
        lon={capturedLon}
      />
    </>
  );

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className={`view${active ? ' active' : ''}`} id="view-form" ref={viewRef}>
      {step === null          && homeScreen}
      {step === 'address'     && addressScreen}
      {step === 'category'    && categoryScreen}
      {step === 'roundabout'  && roundaboutScreen}
      {step === 'notes'       && notesScreen}
      {step === 'photos'      && photosScreen}
      <SignPicker
        open={signPickerOpen}
        onSelect={(code) => { setSignCode(code); setSignNumber(code); }}
        onClose={() => setSignPickerOpen(false)}
      />
      <RoundaboutWizard
        open={wizardOpen}
        initialMode={wizardInitialMode}
        onClose={() => setWizardOpen(false)}
        address={getAddressValue() || '—'}
        lat={capturedLat}
        lon={capturedLon}
        openLightbox={openLightbox}
        showToast={showToast}
        onSavedBatch={(recs) => {
          onSavedBatch(recs);
          showToast(`✅ ${recs.length} רשומות נשמרו!`);
        }}
      />
    </div>
  );
}
