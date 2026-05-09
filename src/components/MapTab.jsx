import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { formatId } from '../utils/formatters';
import { getNextId, getSurveyNextId, loadAddrPairs } from '../utils/storage';
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

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function MapTab({ active, records, showToast, onUpdateRecord, onSaved, mode, openLightbox }) {
  const mapRef = useRef(null);
  const [userPos, setUserPos]           = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [satellite, setSatellite]       = useState(true);
  const [orthoMode, setOrthoMode]       = useState(false);
  const [orthoTms, setOrthoTms]         = useState(true); // gdal2tiles default = TMS
  const [addrSearch, setAddrSearch]     = useState(false);
  const [addrQuery, setAddrQuery]       = useState('');
  const [addrHouse, setAddrHouse]       = useState('');
  const [addrLoading, setAddrLoading]   = useState(false);
  const addrInputRef = useRef(null);
  const addrPairs = loadAddrPairs();
  const streetMap = {};
  addrPairs.forEach(({ street, house }) => {
    if (!streetMap[street]) streetMap[street] = [];
    streetMap[street].push(house);
  });
  const allStreets = Object.keys(streetMap).sort((a, b) => a.localeCompare(b, 'he'));
  const filteredStreets = addrQuery
    ? allStreets.filter(s => s.includes(addrQuery))
    : allStreets;
  const housesForStreet = addrQuery && streetMap[addrQuery] ? streetMap[addrQuery] : [];
  const [addMode, setAddMode]             = useState(false);
  const [pendingPoint, setPendingPoint]   = useState(null);
  const [pendingNotes, setPendingNotes]   = useState('');
  const [pendingStatus, setPendingStatus] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const photoInputRef = useRef(null);

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

  const geocodeAddress = async (street, house) => {
    if (!street) { showToast('⚠️ בחר רחוב'); return; }
    setAddrLoading(true);
    try {
      const q = encodeURIComponent(`${street} ${house}, צפת, ישראל`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=he`,
        { headers: { 'User-Agent': 'FieldCollectorApp/1.0' } }
      );
      const data = await res.json();
      if (!data.length) { showToast('⚠️ הכתובת לא נמצאה'); return; }
      const { lat, lon } = data[0];
      mapRef.current?.setView([parseFloat(lat), parseFloat(lon)], 18);
      setAddrSearch(false);
      setAddrQuery('');
      setAddrHouse('');
    } catch {
      showToast('❌ שגיאה בחיפוש כתובת');
    } finally {
      setAddrLoading(false);
    }
  };

  const cancelAdd = () => {
    setAddMode(false);
    setPendingPoint(null);
    setPendingNotes('');
    setPendingStatus('');
    setPendingPhotos([]);
  };

  const handlePhotoChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPendingPhotos(prev => [...prev, compressed]);
    e.target.value = '';
  }, []);

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
              photos: [...pendingPhotos], date, time, propertyType: '', residents: '', ageGroup: '',
              tenancy: '', ownerId: '', ownerName: '' };
    } else {
      const id = getNextId();
      rec = { id, address, lat, lon, notes: pendingNotes, category: pendingStatus, photos: [...pendingPhotos], date, time };
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
            maxNativeZoom={18}
            maxZoom={21}
          />
        ) : (
          <TileLayer
            key="osm"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxNativeZoom={19}
            maxZoom={21}
          />
        )}
        {orthoMode && (
          <TileLayer
            key={`ortho-${orthoTms}`}
            url="https://archive.gis-net.co.il/Tzfat/GIS/tiles_zfat/{z}/{x}/{y}.jpg"
            tms={orthoTms}
            minZoom={18}
            minNativeZoom={18}
            maxNativeZoom={20}
            maxZoom={22}
            attribution="© GIS-Net אורתופוטו צפת"
            eventHandlers={{
              tileerror: (e) => console.warn('[Ortho] tile error:', e.tile.src),
              tileload:  (e) => console.log('[Ortho] tile ok:',    e.tile.src),
            }}
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
        <button
          className={`map-fab map-fab-ortho${orthoMode ? ' active' : ''}`}
          onClick={() => setOrthoMode(o => !o)}
          title="אורתופוטו צפת"
        >🏙️</button>
        <button
          className={`map-fab map-fab-addr${addrSearch ? ' active' : ''}`}
          onClick={() => { setAddrSearch(s => !s); setTimeout(() => addrInputRef.current?.focus(), 100); }}
          title="חפש כתובת"
        >🔍</button>
      </div>

      {addrSearch && (
        <div className="map-addr-panel">
          <div className="map-addr-row">
            <input
              ref={addrInputRef}
              className="map-addr-input"
              placeholder="חפש רחוב…"
              value={addrQuery}
              onChange={e => { setAddrQuery(e.target.value); setAddrHouse(''); }}
              autoComplete="off"
            />
            {addrQuery && streetMap[addrQuery] && (
              <select
                className="map-addr-house"
                value={addrHouse}
                onChange={e => setAddrHouse(e.target.value)}
              >
                <option value="">מס׳</option>
                {housesForStreet.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            )}
            <button
              className="map-addr-go"
              onClick={() => geocodeAddress(addrQuery, addrHouse)}
              disabled={addrLoading}
            >{addrLoading ? '⏳' : '←'}</button>
          </div>
          {addrQuery && !streetMap[addrQuery] && filteredStreets.length > 0 && (
            <ul className="map-addr-suggestions">
              {filteredStreets.slice(0, 8).map(s => (
                <li key={s} onClick={() => { setAddrQuery(s); setAddrHouse(''); }}>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {orthoMode && (
        <div className="map-ortho-bar">
          <span>אורתופוטו צפת · zoom 18–20</span>
          <button
            className="map-ortho-tms-btn"
            onClick={() => setOrthoTms(t => !t)}
            title="החלף TMS/XYZ"
          >{orthoTms ? 'TMS' : 'XYZ'}</button>
        </div>
      )}

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

          <div className="map-add-photos-row">
            {pendingPhotos.map((src, i) => (
              <div key={i} className="photo-thumb-wrap">
                <img
                  src={src}
                  className="photo-thumb"
                  alt=""
                  onClick={() => openLightbox?.(src)}
                />
                <button
                  className="photo-thumb-remove"
                  onClick={() => setPendingPhotos(p => p.filter((_, j) => j !== i))}
                >✕</button>
              </div>
            ))}
            <button className="map-add-photo-extra" onClick={() => photoInputRef.current?.click()} title="הוסף תמונה נוספת">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" width="18" height="18">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {pendingPhotos.length === 0 ? 'צלם תמונה' : '+ תמונה'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          <div className="map-add-actions">
            <button className="map-add-btn-save" onClick={handleSavePoint}>✅ שמור נקודה</button>
            <button className="map-add-btn-cancel" onClick={cancelAdd}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
