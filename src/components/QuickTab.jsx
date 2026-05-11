import { useState, useEffect, useRef } from 'react';
import { getNextId, getSurveyNextId, getDrainageNextId } from '../utils/storage';
import { compressImage } from '../utils/image';

const STATUS_OPTIONS = {
  signs:    ['תקין', 'לא תקין', 'תמרור להצבה'],
  survey:   ['תקין', 'טעון טיפול', 'הרוס/נטוש'],
  drainage: ['תקין', 'חסום', 'פגום'],
};

const CHIP_CLASS = {
  0: 'ok',
  1: 'bad',
  2: 'att',
};

export default function QuickTab({ active, mode, onSaved, showToast, openLightbox }) {
  const [photo, setPhoto]   = useState(null);
  const [status, setStatus] = useState('');
  const [defect, setDefect] = useState('');
  const [gps, setGps]       = useState({ lat: '', lon: '', state: 'idle' });
  const fileRef             = useRef(null);

  useEffect(() => {
    if (!active) return;
    setGps({ lat: '', lon: '', state: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({
        lat: pos.coords.latitude.toFixed(6),
        lon: pos.coords.longitude.toFixed(6),
        state: 'ok',
      }),
      () => setGps({ lat: '', lon: '', state: 'err' }),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [active]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const compressed = await compressImage(file);
    setPhoto(compressed);
  };

  const nextId = () =>
    mode === 'survey' ? getSurveyNextId()
    : mode === 'drainage' ? getDrainageNextId()
    : getNextId();

  const save = () => {
    const now = new Date();
    onSaved({
      id: nextId(),
      address: '—',
      lat: gps.lat,
      lon: gps.lon,
      notes: '',
      category: status,
      defect: status === 'לא תקין' ? defect : '',
      signNumber: '', signCode: '',
      photos: [photo],
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
    setPhoto(null);
    setStatus('');
    setDefect('');
    setGps({ lat: '', lon: '', state: 'idle' });
    showToast('✅ נשמר!');
  };

  const options = STATUS_OPTIONS[mode] || STATUS_OPTIONS.signs;
  const canSave = photo && status;

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-quick">
      <div className="quick-tab">
        <div className="quick-header">
          <h2>⚡ תיעוד מהיר</h2>
        </div>

        {photo ? (
          <img
            src={photo}
            alt="תמונה"
            className="quick-photo-img"
            onClick={() => openLightbox(photo)}
          />
        ) : (
          <button className="quick-photo-btn" onClick={() => fileRef.current.click()}>
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>צלם תמונה</span>
          </button>
        )}

        {photo && (
          <button
            className="quick-retake"
            onClick={() => fileRef.current.click()}
          >📷 צלם מחדש</button>
        )}

        <div className="quick-chips">
          {options.map((opt, i) => (
            <button
              key={opt}
              className={`quick-chip${status === opt ? ' quick-chip-' + CHIP_CLASS[i] : ''}`}
              onClick={() => { setStatus(opt); if (opt !== 'לא תקין') setDefect(''); }}
            >
              {opt}
            </button>
          ))}
        </div>

        {status === 'לא תקין' && mode === 'signs' && (
          <div className="defect-chips">
            {['תמרור עקום', 'עמוד עקום', 'תמרור דהוי'].map(d => (
              <button
                key={d}
                className={`defect-chip${defect === d ? ' active' : ''}`}
                onClick={() => setDefect(defect === d ? '' : d)}
              >{d}</button>
            ))}
          </div>
        )}

        <div className={`quick-gps${gps.state === 'ok' ? ' ok' : gps.state === 'err' ? ' err' : ''}`}>
          {gps.state === 'idle'     && '📍 לחץ לאיתור מיקום'}
          {gps.state === 'locating' && '📍 מאתר מיקום…'}
          {gps.state === 'ok'       && `📍 ${gps.lat}, ${gps.lon}`}
          {gps.state === 'err'      && '📍 לא נמצא מיקום'}
        </div>

        <button
          className="btn btn-primary step-save-btn quick-save"
          onClick={save}
          disabled={!canSave}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          שמור
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
}
