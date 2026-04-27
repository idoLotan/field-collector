import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatId } from '../utils/formatters';

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 0 0 3px rgba(29,78,216,.35);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
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

export default function MapTab({ active, records, showToast, onUpdateRecord }) {
  const mapRef = useRef(null);
  const [userPos, setUserPos] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);

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

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-map">
      <MapContainer
        id="mapContainer"
        center={[31.5, 34.9]}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        ref={mapRef}
        whenReady={() => {
          goToMyLocation(false);
          setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <MapController active={active} />

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

        {recordsWithCoords.map(r => {
          const fid = formatId(r.id);
          const isLast = r.id === lastRecordId;
          const isEditing = editingRecord?.id === r.id;
          return (
            <Marker
              key={r.id}
              position={[parseFloat(r.lat), parseFloat(r.lon)]}
              icon={makeRecordIcon(fid, isLast)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onUpdateRecord(r.id, lat.toFixed(6), lng.toFixed(6));
                  showToast(`✅ ${fid} עודכן`);
                },
              }}
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
                {r.photos?.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '.75rem', color: 'var(--blue)' }}>
                    📷 {r.photos.length} photo{r.photos.length !== 1 ? 's' : ''}
                  </div>
                )}

                {isEditing ? (
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
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-fab-group">
        <button className="map-fab map-fab-records" onClick={plotRecordMarkers} title="הצג כל הרשומות">📋</button>
        <button className="map-fab map-fab-locate" onClick={() => goToMyLocation(true)} title="המיקום שלי">📍</button>
      </div>
    </div>
  );
}
