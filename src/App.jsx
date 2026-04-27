import { useState, useRef, useCallback } from 'react';
import Header from './components/Header';
import TabNav from './components/TabNav';
import FormTab from './components/FormTab';
import RecordsTab from './components/RecordsTab';
import MapTab from './components/MapTab';
import Overlay from './components/Overlay';
import Lightbox from './components/Lightbox';
import Toast from './components/Toast';
import { loadRecords, persistRecords } from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab]   = useState('form');
  const [records, setRecords]       = useState(() => loadRecords());
  const [overlay, setOverlay]       = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [toastMsg, setToastMsg]     = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const updateRecords = useCallback((newRecords) => {
    persistRecords(newRecords);
    setRecords(newRecords);
  }, []);

  const handleSaved = useCallback((record) => {
    updateRecords([...records, record]);
  }, [records, updateRecords]);

  const handleDelete = useCallback((id) => {
    updateRecords(records.filter(r => r.id !== id));
  }, [records, updateRecords]);

  const handleDeleteAll = useCallback(() => {
    updateRecords([]);
  }, [updateRecords]);

  const handleUpdateRecord = useCallback((id, lat, lon) => {
    updateRecords(records.map(r => r.id === id ? { ...r, lat, lon } : r));
  }, [records, updateRecords]);

  return (
    <div id="app">
      <Header count={records.length} />
      <TabNav activeTab={activeTab} onSwitch={setActiveTab} />

      <FormTab
        active={activeTab === 'form'}
        onSaved={handleSaved}
        showToast={showToast}
        openLightbox={setLightboxSrc}
        onGoToMap={() => setActiveTab('map')}
      />
      <RecordsTab
        active={activeTab === 'records'}
        records={records}
        onDelete={handleDelete}
        onDeleteAll={handleDeleteAll}
        showToast={showToast}
        openLightbox={setLightboxSrc}
        showOverlay={setOverlay}
      />
      <MapTab
        active={activeTab === 'map'}
        records={records}
        showToast={showToast}
        onUpdateRecord={handleUpdateRecord}
      />

      <Overlay overlay={overlay} onClose={() => setOverlay(null)} />
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <Toast msg={toastMsg} />
    </div>
  );
}
