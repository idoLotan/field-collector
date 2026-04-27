import { useSpeech } from '../hooks/useSpeech';

export default function NotesField({ notes, onChange, showToast }) {
  const { active, interim, supported, toggle } = useSpeech((text) => onChange(text));

  const handleToggleMic = () => {
    if (!supported) {
      showToast('❌ זיהוי קול אינו נתמך — השתמש ב-Chrome על אנדרואיד.');
      return;
    }
    toggle(notes);
  };

  return (
    <div className="notes-wrap">
      <label className="notes-lbl">הערות <span>💬</span></label>

      <textarea
        className="notes-textarea"
        value={notes}
        placeholder="כתוב הערות שדה כאן…"
        onChange={e => onChange(e.target.value)}
      />

      {interim && (
        <div className="notes-interim">
          <span className="notes-interim-dot"/>
          {interim}
        </div>
      )}

      <div className={`mic-area${active ? ' mic-area-active' : ''}`}>
        {active && (
          <>
            <span className="mic-ring"/>
            <span className="mic-ring"/>
            <span className="mic-ring"/>
          </>
        )}
        <button
          className={`mic-btn${active ? ' mic-btn-active' : ''}`}
          onClick={handleToggleMic}
          disabled={!supported}
        >
          <span className="mic-btn-icon">
            {active ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8"  y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </span>
          <span className="mic-btn-text">
            {active ? 'מקשיב… לחץ לעצירה' : 'הכתבה קולית'}
          </span>
          {active && (
            <span className="mic-btn-bars">
              <span/><span/><span/><span/><span/>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
