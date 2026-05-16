import { useState } from 'react';
import { formatId } from '../utils/formatters';
import { saveRecordPhotos } from '../utils/export';
import EditRecordSheet from './EditRecordSheet';

export default function RecordCard({ record, onDelete, onEdit, openLightbox, showToast }) {
  const [editing, setEditing] = useState(false);
  const fid = formatId(record.id);

  const handleSavePhotos = async () => {
    try {
      await saveRecordPhotos(record);
    } catch (err) {
      showToast('❌ שגיאה בשמירת תמונות: ' + err.message);
    }
  };

  const categoryClass =
    record.category === 'תקין'          ? 'rec-category-ok'  :
    record.category === 'לא תקין'       ? 'rec-category-bad' :
    record.category === 'תמרור להצבה'  ? 'rec-category-new' : '';

  return (
    <div className="record-card">
      <div className="rec-header">
        <span className="rec-id">{fid}</span>
        <span className="rec-addr">{record.address}</span>
        {record.category && <span className={`rec-category ${categoryClass}`}>{record.category}</span>}
        <span className="rec-datetime">{record.date} {record.time}</span>
      </div>

      {record.signDirection && (
        <div className="rec-sign-info">🔵 {record.signDirection} · תמרור {record.signNumber}</div>
      )}
      {record.defect && <div className="rec-sign-info" style={{color:'var(--orange)'}}>⚠ {record.defect}</div>}
      {record.lat && <div className="rec-coords">📍 {record.lat}, {record.lon}</div>}
      {record.notes && <div className="rec-notes">{record.notes}</div>}

      {record.photos?.length > 0 && (
        <div className="rec-photos">
          {record.photos.map((src, i) => (
            <img key={i} className="rec-photo-thumb" src={src} alt={`${fid}_${i + 1}`} onClick={() => openLightbox(src)} />
          ))}
        </div>
      )}

      <div className="rec-actions">
        {record.photos?.length > 0 && (
          <button className="btn-save-photos" onClick={handleSavePhotos}>💬 שלח לוואצפ</button>
        )}
        <button className="btn btn-ghost" style={{color:'var(--blue)',borderColor:'var(--blue)'}} onClick={() => setEditing(true)}>✏️ ערוך</button>
        <button className="btn btn-ghost" onClick={() => onDelete(record.id)}>🗑 מחק</button>
      </div>

      {editing && (
        <EditRecordSheet
          record={record}
          mode="signs"
          onSave={(updates) => { onEdit(record.id, updates); showToast('✅ הרשומה עודכנה.'); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
