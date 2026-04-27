export default function TabNav({ activeTab, onSwitch }) {
  return (
    <nav className="tabs">
      <button className={activeTab === 'form' ? 'active' : ''} onClick={() => onSwitch('form')}>
        ➕ רשומה חדשה
      </button>
      <button className={activeTab === 'records' ? 'active' : ''} onClick={() => onSwitch('records')}>
        📋 רשומות
      </button>
      <button className={activeTab === 'map' ? 'active' : ''} onClick={() => onSwitch('map')}>
        🗺️ מפה
      </button>
    </nav>
  );
}
