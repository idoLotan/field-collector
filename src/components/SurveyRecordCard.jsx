import { useState } from 'react';
import { formatId } from '../utils/formatters';
import { saveRecordPhotos } from '../utils/export';
import EditRecordSheet from './EditRecordSheet';

const CONDITION_CLASS = {
  'תקין': 'survey-badge-ok',
  'טעון טיפול': 'survey-badge-warn',
  'הרוס/נטוש': 'survey-badge-bad',
};

export default function SurveyRecordCard({ record, onDelete, onEdit, openLightbox, showToast }) {
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
        {record.propertyType && <span className="survey-badge survey-badge-prop">🏠 {record.propertyType}</span>}
        {record.residents    && <span className="survey-badge survey-badge-info">👥 {record.residents} נפשות</span>}
        {record.ageGroup     && <span className="survey-badge survey-badge-info">🎂 {record.ageGroup}</span>}
        {record.tenancy      && <span className="survey-badge survey-badge-info">🔑 {record.tenancy}</span>}
        {record.ownerName    && <span className="survey-badge survey-badge-owner">👤 {record.ownerName}{record.ownerId ? ` · ${record.ownerId}` : ''}</span>}
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
          <button className="btn-save-photos" onClick={handleSavePhotos}>📤 שתף תמונות</button>
        )}
        <button className="btn btn-ghost" style={{color:'var(--blue)',borderColor:'var(--blue)'}} onClick={() => setEditing(true)}>✏️ ערוך</button>
        <button className="btn btn-ghost" onClick={() => onDelete(record.id)}>🗑 מחק</button>
      </div>

      {editing && (
        <EditRecordSheet
          record={record}
          mode="survey"
          onSave={(updates) => { onEdit(record.id, updates); showToast('✅ הרשומה עודכנה.'); }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
