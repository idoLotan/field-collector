import { useRef, useState } from 'react';
import PhotosField from './PhotosField';
import SignPicker, { SIGNS } from './SignPicker';

const SIGNS_CATS    = ['תקין', 'לא תקין', 'תמרור להצבה'];
const DEFECTS       = ['תמרור עקום', 'עמוד עקום', 'תמרור דהוי', 'הזזת תמרור'];
const SURVEY_CONDS  = ['תקין', 'טעון טיפול', 'הרוס/נטוש'];
const SURVEY_PROPS  = ['דירה', 'בית פרטי', 'עסק', 'מוסד'];
const SURVEY_RES    = ['1', '2-3', '4-5', '6+', 'לא ידוע'];
const SURVEY_AGE    = ['ילדים', 'צעירים', 'משפחות', 'קשישים', 'מעורב'];
const SURVEY_TEN    = ['בעלים', 'שוכרים', 'לא ידוע'];
const DRAIN_TYPES   = ['קולטן', 'שוחה', 'צינור', 'תעלה'];
const DRAIN_CONDS   = ['תקין', 'טעון טיפול', 'חסום', 'פגוע', 'הרוס'];

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className="edit-field">
      <div className="edit-lbl">{label}</div>
      <div className="survey-chips">
        {options.map(opt => (
          <button
            key={opt}
            className={`survey-chip${value === opt ? ' survey-chip-active' : ''}`}
            onClick={() => onChange(value === opt ? '' : opt)}
          >{opt}</button>
        ))}
      </div>
    </div>
  );
}

export default function EditRecordSheet({ record, mode, onSave, onClose, openLightbox, showToast }) {
  const photosFieldRef = useRef(null);
  const [address,   setAddress]   = useState(record.address   || '');
  const [notes,     setNotes]     = useState(record.notes     || '');
  const [lat,        setLat]       = useState(record.lat       || '');
  const [lon,        setLon]       = useState(record.lon       || '');
  const [photos,     setPhotos]    = useState(record.photos    || []);
  // signs
  const [category,   setCategory]   = useState(record.category   || '');
  const [defect,     setDefect]     = useState(record.defect     || '');
  const [signNumber, setSignNumber] = useState(record.signNumber || '');
  const [signCode,   setSignCode]   = useState(record.signCode   || '');
  const [signDesc,   setSignDesc]   = useState(record.signDesc   || '');
  const [signPickerOpen, setSignPickerOpen] = useState(false);
  // survey
  const [condition,    setCondition]    = useState(record.condition    || '');
  const [propertyType, setPropertyType] = useState(record.propertyType || '');
  const [residents,    setResidents]    = useState(record.residents    || '');
  const [ageGroup,     setAgeGroup]     = useState(record.ageGroup     || '');
  const [tenancy,      setTenancy]      = useState(record.tenancy      || '');
  // drainage
  const [drainageType, setDrainageType] = useState(record.drainageType || '');
  const [drainCond,    setDrainCond]    = useState(record.condition    || '');

  const handleSave = () => {
    const base = {
      address: address.trim(),
      notes: notes.trim(),
      lat: String(lat).trim(),
      lon: String(lon).trim(),
      photos,
    };
    if (mode === 'signs') {
      onSave({
        ...base,
        category,
        defect: category === 'לא תקין' ? defect : '',
        signNumber: signNumber.trim(),
        signCode,
        signDesc,
      });
    } else if (mode === 'survey') {
      onSave({ ...base, condition, propertyType, residents, ageGroup, tenancy });
    } else {
      onSave({ ...base, drainageType, condition: drainCond });
    }
    onClose();
  };

  return (
    <div className="edit-overlay" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="edit-sheet">

        <div className="edit-sheet-head">
          <span className="edit-sheet-title">עריכת רשומה</span>
          <button className="sign-modal-x" onClick={onClose}>✕</button>
        </div>

        <div className="edit-sheet-body">

          <div className="edit-field">
            <div className="edit-lbl">כתובת</div>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="כתובת…" />
          </div>

          {mode === 'signs' && (
            <>
              <div className="edit-action-row">
                <button className="edit-action-btn" onClick={() => setSignPickerOpen(true)}>
                  <span className="edit-action-icon">🚧</span>
                  <span>בחר תמרור</span>
                </button>
                <button className="edit-action-btn" onClick={() => photosFieldRef.current?.triggerCamera()}>
                  <span className="edit-action-icon">📷</span>
                  <span>צלם תמונה</span>
                </button>
              </div>
              <ChipGroup label="סטטוס" options={SIGNS_CATS} value={category}
                onChange={v => { setCategory(v); if (v !== 'לא תקין') setDefect(''); }} />
              {category === 'לא תקין' && (
                <div className="edit-field">
                  <div className="edit-lbl">סוג פגם</div>
                  <div className="defect-chips" style={{ justifyContent: 'flex-start' }}>
                    {DEFECTS.map(d => (
                      <button key={d} className={`defect-chip${defect === d ? ' active' : ''}`}
                        onClick={() => setDefect(defect === d ? '' : d)}>{d}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="edit-field">
                <div className="edit-lbl">סוג תמרור</div>
                {signCode ? (
                  <div className="sign-selected-row">
                    <div className="sign-selected-icon">
                      {(() => {
                        const selectedSign = SIGNS.find(x => x.code === signCode);
                        return selectedSign ? <img src={selectedSign.img} alt={signCode} /> : null;
                      })()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="sign-selected-label">{signCode}</span>
                      {signDesc && <div style={{ fontSize: '.75rem', color: 'var(--gray)', marginTop: 2 }}>{signDesc}</div>}
                    </div>
                    <button className="sign-change-btn" onClick={() => setSignPickerOpen(true)}>שנה</button>
                    <button className="sign-clear-btn" onClick={() => { setSignCode(''); setSignNumber(''); setSignDesc(''); }}>×</button>
                  </div>
                ) : (
                  <button className="sign-pick-btn" onClick={() => setSignPickerOpen(true)}>
                    לחץ לבחירת סוג תמרור...
                  </button>
                )}
              </div>
              <div className="edit-field">
                <div className="edit-lbl">מספר תמרור</div>
                <input type="text" value={signNumber} onChange={e => setSignNumber(e.target.value)} placeholder="301…" />
              </div>
            </>
          )}

          {mode === 'survey' && (
            <>
              <ChipGroup label="מצב" options={SURVEY_CONDS} value={condition} onChange={setCondition} />
              <ChipGroup label="סוג נכס" options={SURVEY_PROPS} value={propertyType} onChange={setPropertyType} />
              <ChipGroup label="מספר נפשות" options={SURVEY_RES} value={residents} onChange={setResidents} />
              <ChipGroup label="קבוצת גיל" options={SURVEY_AGE} value={ageGroup} onChange={setAgeGroup} />
              <ChipGroup label="בעלות" options={SURVEY_TEN} value={tenancy} onChange={setTenancy} />
            </>
          )}

          {mode === 'drainage' && (
            <>
              <ChipGroup label="סוג ניקוז" options={DRAIN_TYPES} value={drainageType} onChange={setDrainageType} />
              <ChipGroup label="מצב" options={DRAIN_CONDS} value={drainCond} onChange={setDrainCond} />
            </>
          )}

          <div className="edit-field">
            <div className="edit-lbl">הערות</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="הערות…" rows={3} style={{ resize: 'vertical' }} />
          </div>

          <div className="edit-field">
            <div className="edit-lbl">GPS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="text" value={lat} onChange={e => setLat(e.target.value)} placeholder="lat" inputMode="decimal" />
              <input type="text" value={lon} onChange={e => setLon(e.target.value)} placeholder="lon" inputMode="decimal" />
            </div>
          </div>

          <PhotosField
            ref={photosFieldRef}
            photos={photos}
            onChange={setPhotos}
            openLightbox={openLightbox}
            showToast={showToast}
          />

        </div>

        <div className="edit-sheet-foot">
          <button className="btn btn-primary step-save-btn" onClick={handleSave}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            שמור שינויים
          </button>
        </div>

      </div>
      <SignPicker
        open={signPickerOpen}
        onSelect={(code, desc) => { setSignCode(code); setSignNumber(code); setSignDesc(desc || ''); }}
        onClose={() => setSignPickerOpen(false)}
      />
    </div>
  );
}
