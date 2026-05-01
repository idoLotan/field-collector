import { useState, useEffect, useRef, useMemo } from 'react';
import AddressField from './AddressField';
import NotesField from './NotesField';
import PhotosField from './PhotosField';
import { loadDrainageDraft, persistDrainageDraft, clearDrainageDraft, loadAddrPairs, getDrainageNextId } from '../utils/storage';

const DRAINAGE_TYPES = [
  { key: 'קולטן', img: '/signs/koltan.png' },
  { key: 'שוחה',  img: '/signs/shoha.png'  },
  { key: 'צינור', img: '/signs/tzinor.png' },
  { key: 'תעלה',  img: '/signs/teala.png'  },
];

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

function ChipRow({ label, options, value, onChange }) {
  return (
    <div className="survey-field">
      <div className="survey-field-label">{label}</div>
      <div className="survey-chips">
        {options.map(opt => (
          <button
            key={opt}
            className={`survey-chip${value === opt ? ' survey-chip-active' : ''}`}
            onClick={() => onChange(value === opt ? '' : opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageChipRow({ label, value, onChange }) {
  return (
    <div className="survey-field">
      <div className="survey-field-label">{label}</div>
      <div className="drainage-type-chips">
        {DRAINAGE_TYPES.map(({ key, img }) => (
          <button
            key={key}
            className={`drainage-type-chip${value === key ? ' active' : ''}`}
            onClick={() => onChange(value === key ? '' : key)}
          >
            <img src={img} alt={key} className="drainage-type-img" />
            <span>{key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DrainageFormTab({ active, onSaved, showToast, openLightbox }) {
  const draft = useMemo(() => loadDrainageDraft(), []);

  const [addrMode, setAddrMode]             = useState(draft?.addressMode || 'list');
  const [selectedStreet, setSelectedStreet] = useState(draft?.street || '');
  const [selectedHouse, setSelectedHouse]   = useState(draft?.house || '');
  const [streetInput, setStreetInput]       = useState(draft?.street || '');
  const [freeText, setFreeText]             = useState(draft?.fAddressFree || '');
  const [capturedLat, setCapturedLat]       = useState(draft?.lat || null);
  const [capturedLon, setCapturedLon]       = useState(draft?.lon || null);
  const [drainageType, setDrainageType]     = useState(draft?.drainageType || '');
  const [condition, setCondition]           = useState(draft?.condition || '');
  const [material, setMaterial]             = useState(draft?.material || '');
  const [notes, setNotes]                   = useState(draft?.notes || '');
  const [stagingPhotos, setStagingPhotos]   = useState(draft?.photos || []);
  const [addrPairs, setAddrPairs]           = useState(() => loadAddrPairs());
  const [formKey, setFormKey]               = useState(0);
  const [step, setStep]                     = useState(null);
  const [gpsLoading, setGpsLoading]         = useState(false);

  const viewRef = useRef(null);

  useEffect(() => {
    persistDrainageDraft({
      addressMode: addrMode, street: selectedStreet, house: selectedHouse,
      fAddressFree: freeText, lat: capturedLat, lon: capturedLon,
      drainageType, condition, material, notes, photos: stagingPhotos,
    });
  }, [addrMode, selectedStreet, selectedHouse, freeText, capturedLat, capturedLon,
      drainageType, condition, material, notes, stagingPhotos]);

  useEffect(() => { viewRef.current?.scrollTo(0, 0); }, [step]);

  const getAddressValue = () => {
    if (addrMode === 'free') return freeText.trim();
    if (!selectedStreet && !selectedHouse) return '';
    if (!selectedHouse) return selectedStreet;
    return `${selectedStreet} ${selectedHouse}`;
  };

  const handleStreetPick  = (street) => { setSelectedStreet(street); setStreetInput(street); setSelectedHouse(''); };
  const handleStreetInput = (val) => {
    setStreetInput(val);
    if (val !== selectedStreet) { setSelectedStreet(''); setSelectedHouse(''); }
  };

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

  const saveRecord = () => {
    const address = getAddressValue();
    if (!address && !capturedLat) {
      showToast('⚠️ הכנס כתובת או לכוד מיקום GPS תחילה.');
      return;
    }
    const now = new Date();
    const record = {
      id: getDrainageNextId(),
      address: address || '—',
      lat: capturedLat || '',
      lon: capturedLon || '',
      drainageType, condition, material,
      notes: notes.trim(),
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      photos: [...stagingPhotos],
    };
    onSaved(record);
    clearDrainageDraft();
    showToast('✅ הרשומה נשמרה!');
    setSelectedStreet(''); setSelectedHouse(''); setStreetInput('');
    setFreeText(''); setNotes('');
    setDrainageType(''); setCondition(''); setMaterial('');
    setCapturedLat(null); setCapturedLon(null); setStagingPhotos([]);
    setFormKey(k => k + 1);
    setStep(null);
  };

  const addrValue  = getAddressValue();
  const addrDone   = !!(addrValue || capturedLat);
  const catDone    = !!(drainageType || condition || material);
  const notesDone  = !!notes.trim();
  const photosDone = stagingPhotos.length > 0;

  const Back = () => (
    <button className="step-back" onClick={() => setStep(null)}>{'<'} חזרה</button>
  );

  const homeScreen = (
    <>
      <div className="form-home-header">
        <h2>רשומת ניקוז חדשה</h2>
        <p>בחר קטגוריה להזנת מידע</p>
      </div>
      <div className="form-tiles">
        <button className={`form-tile${addrDone ? ' done' : ''}`} onClick={() => setStep('address')}>
          <div className="form-tile-icon"><IconLocation /></div>
          <span className="form-tile-label">כתובת ומיקום</span>
          {addrDone && <span className="form-tile-check">✓</span>}
        </button>
        <button className={`form-tile${catDone ? ' done' : ''}`} onClick={() => setStep('category')}>
          <div className="form-tile-icon"><IconTag /></div>
          <span className="form-tile-label">סיווג רכיב</span>
          {catDone && <span className="form-tile-check">✓</span>}
        </button>
        <button className={`form-tile${notesDone ? ' done' : ''}`} onClick={() => setStep('notes')}>
          <div className="form-tile-icon"><IconNotes /></div>
          <span className="form-tile-label">הערות</span>
          {notesDone && <span className="form-tile-check">✓</span>}
        </button>
        <button className={`form-tile${photosDone ? ' done' : ''}`} onClick={() => setStep('photos')}>
          <div className="form-tile-icon"><IconCamera /></div>
          <span className="form-tile-label">תמונות</span>
          {photosDone && <span className="form-tile-check">{stagingPhotos.length}</span>}
        </button>
      </div>
      <button className="btn btn-primary step-save-btn" onClick={saveRecord}>שמור רשומה 💾</button>
    </>
  );

  const addressScreen = (
    <>
      <div className="step-header">
        <h2>הזנת כתובת</h2>
        <p>בחר דרך נוחה להזנת הכתובת</p>
      </div>
      <div className="addr-mode-lg">
        <button className={`addr-mode-btn${addrMode === 'list' ? ' active' : ''}`} onClick={() => setAddrMode('list')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          רחוב + מספר
        </button>
        <button className={`addr-mode-btn${addrMode === 'free' ? ' active' : ''}`} onClick={() => setAddrMode('free')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          טקסט חופשי
        </button>
      </div>
      {addrMode === 'free' ? (
        <input className="addr-main-input" type="text" value={freeText}
          placeholder="הכנס כתובת מלאה…" onChange={e => setFreeText(e.target.value)} />
      ) : (
        <AddressField
          key={`daddr-${formKey}`}
          mode={addrMode} onModeChange={setAddrMode}
          selectedStreet={selectedStreet} selectedHouse={selectedHouse}
          streetInput={streetInput} onStreetInput={handleStreetInput}
          onStreetPick={handleStreetPick} onHousePick={setSelectedHouse}
          freeText={freeText} onFreeTextChange={setFreeText}
          addrPairs={addrPairs} onAddrPairsChange={setAddrPairs}
          showToast={showToast} compact
        />
      )}
      {capturedLat && (
        <div className="addr-gps-badge">
          📍 {capturedLat}, {capturedLon}
          <button onClick={() => { setCapturedLat(null); setCapturedLon(null); }}>✕</button>
        </div>
      )}
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
          <span className="addr-action-label">מיקום נוכחי</span>
        </button>
      </div>
      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={() => setStep(null)}>המשך</button>
      </div>
    </>
  );

  const categoryScreen = (
    <>
      <div className="step-header">
        <h2>סיווג רכיב ניקוז</h2>
        <p>בחר את סוג הרכיב ומצבו</p>
      </div>

      <ImageChipRow label="סוג רכיב" value={drainageType} onChange={setDrainageType} />

      <ChipRow label="מצב" value={condition} onChange={setCondition}
        options={['תקין', 'טעון טיפול', 'חסום', 'פגוע', 'הרוס']} />

      <ChipRow label="חומר" value={material} onChange={setMaterial}
        options={['בטון', 'פלסטיק', 'מתכת', 'אחר']} />

      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={() => setStep(null)}>המשך</button>
      </div>
    </>
  );

  const notesScreen = (
    <>
      <div className="step-header">
        <h2>הערות</h2>
        <p>הוסף הערות לרשומה</p>
      </div>
      <div className="field">
        <NotesField key={`dnotes-${formKey}`} notes={notes} onChange={setNotes} showToast={showToast} />
      </div>
      <button className="btn-skip" onClick={() => { setNotes(''); setStep(null); }}>ללא הערות</button>
      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={saveRecord}>שמור רשומה</button>
      </div>
    </>
  );

  const photosScreen = (
    <>
      <div className="step-header">
        <h2>תמונות</h2>
        <p>צלם או הוסף תמונות לרשומה</p>
      </div>
      <PhotosField key={`dphotos-${formKey}`} photos={stagingPhotos}
        onChange={setStagingPhotos} openLightbox={openLightbox} showToast={showToast} />
      <button className="btn-skip" onClick={() => { setStagingPhotos([]); setStep(null); }}>ללא תמונות</button>
      <div className="step-footer">
        <Back />
        <button className="btn btn-primary" onClick={() => setStep(null)}>המשך</button>
      </div>
    </>
  );

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-form" ref={viewRef}>
      {step === null       && homeScreen}
      {step === 'address'  && addressScreen}
      {step === 'category' && categoryScreen}
      {step === 'notes'    && notesScreen}
      {step === 'photos'   && photosScreen}
    </div>
  );
}
