import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { formatId } from '../utils/formatters';
import { getNextId, getSurveyNextId } from '../utils/storage';
import { useCompass } from '../utils/useCompass';
import CompassWidget from './CompassWidget';

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,78,216,.35);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const pendingIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 0 0 3px rgba(245,158,11,.4);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function makeRecordIcon(fid, isLast = false) {
  const bg = isLast ? '#dc2626' : '#16a34a';
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:#fff;font-size:.65rem;font-weight:700;font-family:monospace;padding:3px 5px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;">${fid}</div>`,
    iconAnchor: [20, 14],
  });
}

function MapController({ active }) {
  const map = useMap();
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => map.invalidateSize(), 50);
      return () => clearTimeout(t);
    }
  }, [active, map]);
  return null;
}

function MapClickHandler({ addMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (addMode) onMapClick(e.latlng);
    },
  });
  return null;
}

const SIGNS_STATUSES  = ['תקין', 'לא תקין', 'תמרור להצבה'];
const SURVEY_STATUSES = ['תקין', 'טעון טיפול', 'הרוס/נטוש'];

export default function MapTab({ active, records, showToast, onUpdateRecord, onSaved, mode }) {
  const mapRef = useRef(null);
  const [userPos, setUserPos]           = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [satellite, setSatellite]       = useState(false);
  const [addMode, setAddMode]           = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [pendingNotes, setPendingNotes] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');

  const { heading, active: compassActive, toggle: toggleCompass } = useCompass();

  const statusOptions = mode === 'survey' ? SURVEY_STATUSES : SIGNS_STATUSES;

  const goToMyLocation = (showError = true) => {
    if (!navigator.geolocation) {
      if (showError) showToast('❌ Geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lon, accuracy: acc } = coords;
        setUserPos([lat, lon]);
        setUserAccuracy(acc);
        mapRef.current?.setView([lat, lon], 16);
      },
      (err) => {
        if (!showError) return;
        const msgs = { 1: 'הרשאת מיקום נדחתה.', 2: 'לא ניתן לאתר מיקום.', 3: 'פג זמן.' };
        showToast('❌ ' + (msgs[err.code] || err.message));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const plotRecordMarkers = () => {
    const withCoords = records.filter(r => r.lat && r.lon);
    if (!withCoords.length) { showToast('ℹ️ אין רשומות עם מיקום GPS עדיין.'); return; }
    const bounds = withCoords.map(r => [parseFloat(r.lat), parseFloat(r.lon)]);
    mapRef.current?.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };

  useEffect(() => {
    if (active && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 50);
    }
  }, [active]);

  // Cancel add mode when tab becomes inactive
  useEffect(() => {
    if (!active) cancelAdd();
  }, [active]);

  const recordsWithCoords = records.filter(r => r.lat && r.lon);
  const lastRecordId = recordsWithCoords.length
    ? Math.max(...recordsWithCoords.map(r => r.id))
    : null;

  const saveEdit = () => {
    const lat = parseFloat(editingRecord.lat);
    const lon = parseFloat(editingRecord.lon);
    if (isNaN(lat) || isNaN(lon)) { showToast('❌ ערכים לא תקינים'); return; }
    onUpdateRecord(editingRecord.id, lat.toFixed(6), lon.toFixed(6));
    setEditingRecord(null);
    showToast('✅ קואורדינטות עודכנו');
  };

  const cancelAdd = () => {
    setAddMode(false);
    setPendingPoint(null);
    setPendingNotes('');
    setPendingStatus('');
  };

  const handleMapClick = (latlng) => {
    setPendingPoint(latlng);
  };

  const handleSavePoint = () => {
    if (!pendingPoint) { showToast('❌ לחץ על המפה לבחירת מיקום'); return; }
    const now = new Date();
    const date = now.toLocaleDateString('he-IL');
    const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const lat  = pendingPoint.lat.toFixed(6);
    const lon  = pendingPoint.lng.toFixed(6);
    const address = `${lat}, ${lon}`;

    let rec;
    if (mode === 'survey') {
      const id = getSurveyNextId();
      rec = { id, address, lat, lon, notes: pendingNotes, condition: pendingStatus,
              photos: [], date, time, propertyType: '', residents: '', ageGroup: '',
              tenancy: '', ownerId: '', ownerName: '' };
    } else {
      const id = getNextId();
      rec = { id, address, lat, lon, notes: pendingNotes, category: pendingStatus, photos: [], date, time };
    }

    onSaved(rec);
    cancelAdd();
    showToast('✅ נקודה נשמרה');
  };

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-map">
      <MapContainer
        id="mapContainer"
        center={[31.5, 34.9]}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        ref={mapRef}
        className={addMode ? 'map-add-cursor' : ''}
        whenReady={() => {
          goToMyLocation(false);
          setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }}
      >
        {satellite ? (
          <TileLayer
            key="sat"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="© Esri"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            key="osm"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
        )}
        <MapController active={active} />
        <MapClickHandler addMode={addMode} onMapClick={handleMapClick} />

        {userPos && (
          <>
            <Marker position={userPos} icon={userIcon}>
              <Popup>
                <strong>המיקום שלך</strong><br />
                דיוק: ±{Math.round(userAccuracy)} מ'
              </Popup>
            </Marker>
            <Circle
              center={userPos}
              radius={userAccuracy}
              pathOptions={{ color: '#3b82f6', fillOpacity: 0.08, weight: 1 }}
            />
          </>
        )}

        {pendingPoint && (
          <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={pendingIcon} />
        )}

        {recordsWithCoords.map(r => {
          const fid = formatId(r.id);
          const isLast = r.id === lastRecordId;
          const isEditing = editingRecord?.id === r.id;
          return (
            <Marker
              key={r.id}
              position={[parseFloat(r.lat), parseFloat(r.lon)]}
              icon={makeRecordIcon(fid, isLast)}
              draggable={!!onUpdateRecord}
              eventHandlers={onUpdateRecord ? {
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onUpdateRecord(r.id, lat.toFixed(6), lng.toFixed(6));
                  showToast(`✅ ${fid} עודכן`);
                },
              } : {}}
            >
              <Popup maxWidth={260} onClose={() => { if (isEditing) setEditingRecord(null); }}>
                <span className="map-popup-id" style={isLast ? { background: '#dc2626' } : {}}>
                  {fid}{isLast ? ' ★' : ''}
                </span>
                <div className="map-popup-addr">{r.address}</div>
                <div className="map-popup-date">{r.date} · {r.time}</div>
                {r.notes && (
                  <div className="map-popup-notes">
                    {r.notes.slice(0, 120)}{r.notes.length > 120 ? '…' : ''}
                  </div>
                )}
                {(r.condition || r.category) && (
                  <div className="map-popup-status">{r.condition || r.category}</div>
                )}
                {r.photos?.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '.75rem', color: 'var(--blue)' }}>
                    📷 {r.photos.length} photo{r.photos.length !== 1 ? 's' : ''}
                  </div>
                )}

                {onUpdateRecord && (isEditing ? (
                  <div className="map-popup-edit">
                    <div className="map-popup-edit-row">
                      <label>קו רוחב</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingRecord.lat}
                        onChange={e => setEditingRecord({ ...editingRecord, lat: e.target.value })}
                      />
                    </div>
                    <div className="map-popup-edit-row">
                      <label>קו אורך</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editingRecord.lon}
                        onChange={e => setEditingRecord({ ...editingRecord, lon: e.target.value })}
                      />
                    </div>
                    <div className="map-popup-edit-actions">
                      <button className="map-popup-btn map-popup-btn-save" onClick={saveEdit}>שמור</button>
                      <button className="map-popup-btn map-popup-btn-cancel" onClick={() => setEditingRecord(null)}>ביטול</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="map-popup-btn map-popup-btn-edit"
                    onClick={() => setEditingRecord({ id: r.id, lat: r.lat, lon: r.lon })}
                  >
                    ✏️ ערוך מיקום
                  </button>
                ))}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {compassActive && (
        <div className="map-compass">
          <CompassWidget heading={heading} size={56} />
        </div>
      )}

      {addMode && (
        <div className="map-add-banner">
          {pendingPoint ? '✅ מיקום נבחר — מלא פרטים למטה' : '👆 לחץ על המפה לבחירת מיקום'}
        </div>
      )}

      <div className="map-fab-group">
        {onSaved && (
          <button
            className={`map-fab map-fab-add${addMode ? ' active' : ''}`}
            onClick={() => addMode ? cancelAdd() : setAddMode(true)}
            title={addMode ? 'בטל הוספה' : 'הוסף נקודה'}
          >
            {addMode ? '✕' : '＋'}
          </button>
        )}
        <button className="map-fab map-fab-records" onClick={plotRecordMarkers} title="הצג כל הרשומות">📋</button>
        <button className="map-fab map-fab-locate" onClick={() => goToMyLocation(true)} title="המיקום שלי">📍</button>
        <button
          className={`map-fab map-fab-compass${compassActive ? ' active' : ''}`}
          onClick={() => toggleCompass(showToast)}
          title="מצפן"
        >🧭</button>
        <button
          className={`map-fab map-fab-satellite${satellite ? ' active' : ''}`}
          onClick={() => setSatellite(s => !s)}
          title={satellite ? 'מפה רגילה' : 'תצלום לווין'}
        >🛰️</button>
      </div>

      {addMode && (
        <div className={`map-add-sheet${pendingPoint ? ' visible' : ''}`}>
          <div className="map-add-sheet-title">הוספת נקודה ידנית</div>

          <div className="map-add-chips-label">סטטוס</div>
          <div className="map-add-chips">
            {statusOptions.map(s => (
              <button
                key={s}
                className={`map-add-chip${pendingStatus === s ? ' active' : ''}`}
                onClick={() => setPendingStatus(prev => prev === s ? '' : s)}
              >
                {s}
              </button>
            ))}
          </div>

          <textarea
            className="map-add-notes"
            placeholder="הערות (אופציונלי)…"
            value={pendingNotes}
            onChange={e => setPendingNotes(e.target.value)}
            rows={2}
          />

          <div className="map-add-actions">
            <button className="map-add-btn-save" onClick={handleSavePoint}>✅ שמור נקודה</button>
            <button className="map-add-btn-cancel" onClick={cancelAdd}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
