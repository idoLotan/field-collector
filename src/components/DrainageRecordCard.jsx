import { useState } from 'react';
import { formatId } from '../utils/formatters';
import { saveRecordPhotos } from '../utils/export';
import EditRecordSheet from './EditRecordSheet';

const TYPE_IMG = {
  'קולטן': '/signs/koltan.png',
  'שוחה':  '/signs/shoha.png',
  'צינור': '/signs/tzinor.png',
  'תעלה':  '/signs/teala.png',
};

const CONDITION_CLASS = {
  'תקין':        'drainage-badge-ok',
  'טעון טיפול': 'drainage-badge-warn',
  'חסום':        'drainage-badge-blocked',
  'פגוע':        'drainage-badge-damaged',
  'הרוס':        'drainage-badge-bad',
};

export default function DrainageRecordCard({ record, onDelete, onEdit, openLightbox, showToast }) {
  const [editing, setEditing] = useState(false);
  const fid = formatId(record.id);

  const handleSavePhotos = async () => {
    try { await saveRecordPhotos(record); }
    catch (err) { showToast('❌ שגיאה בשמירת תמונות: ' + err.message); }
  };

  return (
    <div className="record-card">
      <div className="rec-header">
        <span className="rec-id">{fid}</span>
        <span className="rec-addr">{record.address}</span>
        {record.condition && (
          <span className={`rec-category ${CONDITION_CLASS[record.condition] || ''}`}>{record.condition}</span>
        )}
        <span className="rec-datetime">{record.date} {record.time}</span>
      </div>

      {record.lat && <div className="rec-coords">📍 {record.lat}, {record.lon}</div>}

      <div className="survey-card-fields">
        {record.drainageType && (
          <span className="survey-badge drainage-badge-type">
            {TYPE_IMG[record.drainageType] && (
              <img src={TYPE_IMG[record.drainageType]} alt={record.drainageType}
                style={{ width: 18, height: 18, objectFit: 'contain', verticalAlign: 'middle', marginLeft: 4 }} />
            )}
            {record.drainageType}
          </span>
        )}
        {record.material && (
          <span className="survey-badge survey-badge-info">🧱 {record.material}</span>
        )}
      </div>

      {record.notes && <div className="rec-notes">{record.notes}</div>}

      {record.photos?.length > 0 && (
        <div className="rec-photos">
          {record.photos.map((src, i) => (
            <img key={i} className="rec-photo-thumb" src={src} alt={`${fid}_${i + 1}`}
              onClick={() => openLightbox(src)} />
          ))}
        </div>
      )}

      <div className="rec-actions">
        {record.photos?.length > 0 && (
          <button className="btn-save-photos" onClick={handleSavePhotos}>📥 שמור תמונות</button>
        )}
        <button className="btn btn-ghost" style={{color:'var(--blue)',borderColor:'var(--blue)'}} onClick={() => setEditing(true)}>✏️ ערוך</button>
        <button className="btn btn-ghost" onClick={() => onDelete(record.id)}>🗑 מחק</button>
      </div>

      {editing && (
        <EditRecordSheet
          record={record}
          mode="drainage"
          onSave={(updates) => { onEdit(record.id, updates); showToast('✅ הרשומה עודכנה.'); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
