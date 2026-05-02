import { useState, useRef, useCallback } from 'react';
import Header from './components/Header';
import TabNav from './components/TabNav';
import FormTab from './components/FormTab';
import SurveyFormTab from './components/SurveyFormTab';
import DrainageFormTab from './components/DrainageFormTab';
import RecordsTab from './components/RecordsTab';
import MapTab from './components/MapTab';
import Overlay from './components/Overlay';
import Lightbox from './components/Lightbox';
import Toast from './components/Toast';
import { loadRecords, persistRecords, loadSurveyRecords, persistSurveyRecords, loadDrainageRecords, persistDrainageRecords } from './utils/storage';

const MODE_KEY = 'fieldcollector_mode';

export default function App() {
  const [appMode, setAppMode]              = useState(() => localStorage.getItem(MODE_KEY) || 'signs');
  const [activeTab, setActiveTab]          = useState('form');
  const [records, setRecords]              = useState(() => loadRecords());
  const [surveyRecords, setSurveyRecords]  = useState(() => loadSurveyRecords());
  const [drainageRecords, setDrainageRecords] = useState(() => loadDrainageRecords());
  const [overlay, setOverlay]            = useState(null);
  const [lightboxSrc, setLightboxSrc]    = useState(null);
  const [toastMsg, setToastMsg]          = useState(null);
  const toastTimer = useRef(null);

  const switchMode = useCallback((m) => {
    localStorage.setItem(MODE_KEY, m);
    setAppMode(m);
    setActiveTab('form');
  }, []);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  // ── Signs records ──
  const updateRecords = useCallback((r) => { persistRecords(r); setRecords(r); }, []);
  const handleSaved        = useCallback((rec) => updateRecords([...records, rec]), [records, updateRecords]);
  const handleSavedBatch   = useCallback((recs) => updateRecords([...records, ...recs]), [records, updateRecords]);
  const handleDelete       = useCallback((id)  => updateRecords(records.filter(r => r.id !== id)), [records, updateRecords]);
  const handleDeleteAll    = useCallback(()    => updateRecords([]), [updateRecords]);
  const handleUpdateRecord = useCallback((id, lat, lon) =>
    updateRecords(records.map(r => r.id === id ? { ...r, lat, lon } : r)),
    [records, updateRecords]);

  // ── Survey records ──
  const updateSurveyRecords = useCallback((r) => { persistSurveyRecords(r); setSurveyRecords(r); }, []);
  const handleSurveySaved   = useCallback((rec) => updateSurveyRecords([...surveyRecords, rec]), [surveyRecords, updateSurveyRecords]);
  const handleSurveyDelete  = useCallback((id)  => updateSurveyRecords(surveyRecords.filter(r => r.id !== id)), [surveyRecords, updateSurveyRecords]);
  const handleSurveyDeleteAll = useCallback(()  => updateSurveyRecords([]), [updateSurveyRecords]);

  // ── Drainage records ──
  const updateDrainageRecords = useCallback((r) => { persistDrainageRecords(r); setDrainageRecords(r); }, []);
  const handleDrainageSaved   = useCallback((rec) => updateDrainageRecords([...drainageRecords, rec]), [drainageRecords, updateDrainageRecords]);
  const handleDrainageDelete  = useCallback((id)  => updateDrainageRecords(drainageRecords.filter(r => r.id !== id)), [drainageRecords, updateDrainageRecords]);
  const handleDrainageDeleteAll = useCallback(()  => updateDrainageRecords([]), [updateDrainageRecords]);

  const activeRecords = appMode === 'survey' ? surveyRecords : appMode === 'drainage' ? drainageRecords : records;

  return (
    <div id="app">
      <Header count={activeRecords.length} />

      <div className="mode-switcher">
        <select
          className={`mode-select mode-select-${appMode}`}
          value={appMode}
          onChange={e => switchMode(e.target.value)}
        >
          <option value="signs">🚧 סיור תמרורים</option>
          <option value="survey">👥 סקר אוכלוסייה</option>
          <option value="drainage">💧 סקר ניקוז</option>
        </select>
      </div>

      {appMode === 'signs' ? (
        <FormTab
          active={activeTab === 'form'}
          onSaved={handleSaved}
          onSavedBatch={handleSavedBatch}
          showToast={showToast}
          openLightbox={setLightboxSrc}
          onGoToMap={() => setActiveTab('map')}
        />
      ) : appMode === 'survey' ? (
        <SurveyFormTab
          active={activeTab === 'form'}
          onSaved={handleSurveySaved}
          showToast={showToast}
          openLightbox={setLightboxSrc}
        />
      ) : (
        <DrainageFormTab
          active={activeTab === 'form'}
          onSaved={handleDrainageSaved}
          showToast={showToast}
          openLightbox={setLightboxSrc}
        />
      )}

      <RecordsTab
        active={activeTab === 'records'}
        records={activeRecords}
        mode={appMode}
        onDelete={appMode === 'survey' ? handleSurveyDelete : appMode === 'drainage' ? handleDrainageDelete : handleDelete}
        onDeleteAll={appMode === 'survey' ? handleSurveyDeleteAll : appMode === 'drainage' ? handleDrainageDeleteAll : handleDeleteAll}
        showToast={showToast}
        openLightbox={setLightboxSrc}
        showOverlay={setOverlay}
      />
      <MapTab
        active={activeTab === 'map'}
        records={activeRecords}
        mode={appMode}
        showToast={showToast}
        onUpdateRecord={appMode === 'signs' ? handleUpdateRecord : undefined}
        onSaved={appMode === 'survey' ? handleSurveySaved : appMode === 'drainage' ? handleDrainageSaved : handleSaved}
      />

      <TabNav activeTab={activeTab} onSwitch={setActiveTab} />

      <Overlay overlay={overlay} onClose={() => setOverlay(null)} />
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <Toast msg={toastMsg} />
    </div>
  );
}
