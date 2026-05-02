function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" width="21" height="21">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  );
}

function IconRecords() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" width="21" height="21">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" width="21" height="21">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

export default function TabNav({ activeTab, onSwitch }) {
  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-btn${activeTab === 'map' ? ' active' : ''}`}
        onClick={() => onSwitch('map')}
      >
        <IconMap />
        <span>מפה</span>
      </button>

      <button
        className={`bottom-nav-btn${activeTab === 'records' ? ' active' : ''}`}
        onClick={() => onSwitch('records')}
      >
        <IconRecords />
        <span>רשומות</span>
      </button>

      <button
        className={`bottom-nav-btn${activeTab === 'form' ? ' active' : ''}`}
        onClick={() => onSwitch('form')}
      >
        <IconPlus />
        <span>חדשה</span>
      </button>
    </nav>
  );
}
