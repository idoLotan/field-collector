import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { formatId, shortId, compactId } from '../utils/formatters';
import { getNextId, getSurveyNextId, loadAddrPairs } from '../utils/storage';
import { compressImage } from '../utils/image';
import SignPicker, { SIGNS } from './SignPicker';

const DEFAULT_GEOJSON_LAYER_URL = '/layers/signs.geojson';

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

const geoJsonStyle = {
  color: '#6366f1',
  weight: 3,
  opacity: 0.85,
  fillColor: '#6366f1',
  fillOpacity: 0.18,
  dashArray: '5, 5',
};

const geoJsonPointStyle = {
  radius: 7,
  color: '#4338ca',
  weight: 2,
  opacity: 0.95,
  fillColor: '#818cf8',
  fillOpacity: 0.7,
};

const DEFAULT_SLD_POINT_STYLE = {
  color: '#4338ca',
  fillColor: '#818cf8',
  opacity: 0.95,
  fillOpacity: 0.7,
  weight: 2,
  size: 18,
};

const GEO_JSON_TYPES = new Set([
  'FeatureCollection',
  'Feature',
  'GeometryCollection',
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]);

function isGeoJsonObject(value) {
  return value && typeof value === 'object' && GEO_JSON_TYPES.has(value.type);
}

const SIGN_IMAGE_BY_CODE = new Map(SIGNS.map(sign => [sign.code, sign.img]));

function normalizeSignKey(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\.[^.]+$/, '').replace(/^0+(\d)/, '$1');
}

function getFeatureSignImage(feature) {
  const props = feature?.properties || {};
  const rawKey = props.key ?? props.Key ?? props.KEY ?? props.signCode ?? props.SignCode ?? props.sign_code;
  const key = normalizeSignKey(rawKey);
  if (!key) return null;
  return SIGN_IMAGE_BY_CODE.get(key) || `/signs/${key}.png`;
}

function makeGeoJsonPointIcon(active = false, pointStyle = DEFAULT_SLD_POINT_STYLE, signImage = null) {
  const size = Number(pointStyle.size) || 18;
  const borderWidth = Math.max(2, Math.round(size / 6));
  const bg = active ? '#f59e0b' : (pointStyle.fillColor || pointStyle.color || '#6366f1');
  const border = pointStyle.color || '#4338ca';
  const opacity = pointStyle.fillOpacity ?? pointStyle.opacity ?? 0.85;
  const imageSize = Math.max(28, size + 18);
  const imageBorder = active ? '#f59e0b' : border;

  if (signImage) {
    return L.divIcon({
      className: '',
      html: `
        <div class="geojson-sign-marker${active ? ' moving' : ''}" style="--marker-border:${imageBorder};--marker-size:${imageSize}px;">
          <img src="${signImage}" alt="" />
        </div>
      `,
      iconSize: [imageSize, imageSize],
      iconAnchor: [imageSize / 2, imageSize / 2],
    });
  }

  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};opacity:${opacity};border:${borderWidth}px solid #fff;box-shadow:0 0 0 2px ${border};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function getXmlChildren(node, localName) {
  return Array.from(node?.children || []).filter(child => child.localName === localName);
}

function getXmlDescendants(node, localName) {
  return Array.from(node?.getElementsByTagName('*') || []).filter(child => child.localName === localName);
}

function getXmlText(node) {
  return node?.textContent?.trim() || '';
}

function getNamedSldValue(node, name) {
  return getXmlDescendants(node, 'CssParameter')
    .concat(getXmlDescendants(node, 'SvgParameter'))
    .find(param => param.getAttribute('name') === name)?.textContent?.trim();
}

function parseSldNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseSldSymbolizer(ruleNode) {
  const strokeNode = getXmlDescendants(ruleNode, 'Stroke')[0];
  const fillNode = getXmlDescendants(ruleNode, 'Fill')[0];
  const sizeNode = getXmlDescendants(ruleNode, 'Size')[0];

  const style = {};
  const stroke = strokeNode && getNamedSldValue(strokeNode, 'stroke');
  const strokeWidth = strokeNode && getNamedSldValue(strokeNode, 'stroke-width');
  const strokeOpacity = strokeNode && getNamedSldValue(strokeNode, 'stroke-opacity');
  const strokeDasharray = strokeNode && getNamedSldValue(strokeNode, 'stroke-dasharray');
  const fill = fillNode && getNamedSldValue(fillNode, 'fill');
  const fillOpacity = fillNode && getNamedSldValue(fillNode, 'fill-opacity');

  if (stroke) style.color = stroke;
  if (strokeWidth) style.weight = parseSldNumber(strokeWidth, 3);
  if (strokeOpacity) style.opacity = parseSldNumber(strokeOpacity, 0.85);
  if (strokeDasharray) style.dashArray = strokeDasharray;
  if (fill) style.fillColor = fill;
  if (fillOpacity) style.fillOpacity = parseSldNumber(fillOpacity, 0.18);
  if (sizeNode) style.size = parseSldNumber(getXmlText(sizeNode), 18);

  return style;
}

function parseSldFilter(ruleNode) {
  if (getXmlDescendants(ruleNode, 'ElseFilter').length) return { type: 'else' };

  const equal = getXmlDescendants(ruleNode, 'PropertyIsEqualTo')[0];
  const notEqual = getXmlDescendants(ruleNode, 'PropertyIsNotEqualTo')[0];
  const like = getXmlDescendants(ruleNode, 'PropertyIsLike')[0];
  const comparison = equal || notEqual || like;
  if (!comparison) return null;

  const property = getXmlText(getXmlDescendants(comparison, 'PropertyName')[0]);
  const literal = getXmlText(getXmlDescendants(comparison, 'Literal')[0]);
  if (!property) return null;

  if (equal) return { type: 'equals', property, literal };
  if (notEqual) return { type: 'notEquals', property, literal };
  return { type: 'like', property, literal };
}

function parseSld(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('קובץ SLD לא תקין');

  const rules = getXmlDescendants(doc, 'Rule').map((ruleNode, index) => ({
    name: getXmlText(getXmlChildren(ruleNode, 'Name')[0]) || getXmlText(getXmlChildren(ruleNode, 'Title')[0]) || `Rule ${index + 1}`,
    filter: parseSldFilter(ruleNode),
    style: parseSldSymbolizer(ruleNode),
  })).filter(rule => Object.keys(rule.style).length > 0);

  if (!rules.length) throw new Error('לא נמצאו כללי סימבולוגיה נתמכים ב-SLD');
  return rules;
}

function matchesSldRule(feature, rule, matchedAny) {
  const filter = rule.filter;
  if (!filter) return true;
  if (filter.type === 'else') return !matchedAny;

  const rawValue = feature?.properties?.[filter.property];
  const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);
  const literal = String(filter.literal ?? '');

  if (filter.type === 'equals') return value === literal;
  if (filter.type === 'notEquals') return value !== literal;
  if (filter.type === 'like') {
    const pattern = literal
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replaceAll('\\*', '.*')
      .replaceAll('%', '.*');
    return new RegExp(`^${pattern}$`, 'i').test(value);
  }
  return false;
}

function getSldStyleForFeature(feature, rules) {
  if (!rules?.length) return null;
  let matchedAny = false;
  for (const rule of rules) {
    const matches = matchesSldRule(feature, rule, matchedAny);
    if (matches) return rule.style;
    if (rule.filter?.type !== 'else') {
      matchedAny = matchedAny || matches;
    }
  }
  return null;
}

function formatFeaturePopup(feature) {
  const props = feature?.properties || {};
  const entries = Object.entries(props).filter(([key, value]) => !key.startsWith('__') && value !== null && value !== undefined && value !== '');
  if (!entries.length) return '<div class="geojson-popup-empty">אין שדות להצגה</div>';

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  return `
    <div class="geojson-popup">
      ${entries.map(([key, value]) => `
        <div class="geojson-popup-row">
          <span class="geojson-popup-key">${escapeHtml(key)}</span>
          <span class="geojson-popup-value">${escapeHtml(value)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function assignGeoJsonFeatureIds(json) {
  let nextId = 1;
  const assign = (feature) => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      __layerId: feature.properties?.__layerId || `layer-${nextId++}`,
    },
  });

  if (json.type === 'FeatureCollection') {
    return { ...json, features: (json.features || []).map(assign) };
  }
  if (json.type === 'Feature') return assign(json);
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { __layerId: `layer-${nextId++}` }, geometry: json }],
  };
}

function updatePointFeatureCoordinates(json, layerId, lng, lat) {
  const updateFeature = (feature) => {
    if (feature.properties?.__layerId !== layerId || feature.geometry?.type !== 'Point') return feature;
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: [lng, lat, ...feature.geometry.coordinates.slice(2)],
      },
    };
  };

  if (json.type === 'FeatureCollection') {
    return { ...json, features: json.features.map(updateFeature) };
  }
  if (json.type === 'Feature') return updateFeature(json);
  return json;
}

function mapCoordinateTree(coords, transform) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [lng, lat] = transform(coords[0], coords[1]);
    return [lng, lat, ...coords.slice(2)];
  }
  return coords.map(child => mapCoordinateTree(child, transform));
}

function updateGeometryCoordinates(geometry, transform) {
  if (!geometry) return;
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries?.forEach(child => updateGeometryCoordinates(child, transform));
    return;
  }
  if (geometry.coordinates) {
    geometry.coordinates = mapCoordinateTree(geometry.coordinates, transform);
  }
}

function collectCoordinatesFromGeometry(geometry, out) {
  if (!geometry || out.length >= 24) return;
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries?.forEach(child => collectCoordinatesFromGeometry(child, out));
    return;
  }
  const walk = (coords) => {
    if (!Array.isArray(coords) || out.length >= 24) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      out.push([coords[0], coords[1]]);
      return;
    }
    coords.forEach(walk);
  };
  walk(geometry.coordinates);
}

function collectGeoJsonCoordinates(json) {
  const coords = [];
  if (json.type === 'FeatureCollection') {
    json.features?.forEach(feature => collectCoordinatesFromGeometry(feature.geometry, coords));
  } else if (json.type === 'Feature') {
    collectCoordinatesFromGeometry(json.geometry, coords);
  } else {
    collectCoordinatesFromGeometry(json, coords);
  }
  return coords;
}

function detectGeoJsonProjection(json, coords) {
  const crsName = JSON.stringify(json.crs || '').toLowerCase();
  if (crsName.includes('3857') || crsName.includes('900913') || crsName.includes('mercator')) return 'webMercator';
  if (crsName.includes('2039') || crsName.includes('6991') || crsName.includes('israel') || crsName.includes('itm')) return 'itm';

  const hasWgs84Range = coords.some(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);
  const hasWebMercatorRange = coords.some(([x, y]) => Math.abs(x) > 1000000 && Math.abs(y) > 1000000);
  const hasIsraelGridRange = coords.some(([x, y]) => x >= 100000 && x <= 300000 && y >= 300000 && y <= 900000);

  if (hasWgs84Range) return 'wgs84';
  if (hasWebMercatorRange) return 'webMercator';
  if (hasIsraelGridRange) return 'itm';
  return 'wgs84';
}

function webMercatorToWgs84(x, y) {
  const lng = x / 20037508.34 * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34 * 180) * Math.PI / 180)) * 360 / Math.PI) - 90;
  return [lng, lat];
}

function israelTmToWgs84(easting, northing) {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const lat0 = 31.73439361111111 * Math.PI / 180;
  const lon0 = 35.20451694444445 * Math.PI / 180;
  const k0 = 1.0000067;
  const falseE = 219529.584;
  const falseN = 626907.39;

  const meridionalArc = (lat) => a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat)
  );

  const m0 = meridionalArc(lat0);
  const m = m0 + (northing - falseN) / k0;
  const mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const n1 = a / Math.sqrt(1 - e2 * sinPhi1 ** 2);
  const r1 = a * (1 - e2) / (1 - e2 * sinPhi1 ** 2) ** 1.5;
  const t1 = tanPhi1 ** 2;
  const c1 = ep2 * cosPhi1 ** 2;
  const d = (easting - falseE) / (n1 * k0);

  const lat = phi1 - (n1 * tanPhi1 / r1) * (
    d ** 2 / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720
  );
  const lng = lon0 + (
    d
    - (1 + 2 * t1 + c1) * d ** 3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
  ) / cosPhi1;

  return [lng * 180 / Math.PI, lat * 180 / Math.PI];
}

function normalizeGeoJsonProjection(json) {
  const coords = collectGeoJsonCoordinates(json);
  const projection = detectGeoJsonProjection(json, coords);
  if (projection === 'wgs84') return { json, projection };

  const normalized = JSON.parse(JSON.stringify(json));
  const transform = projection === 'webMercator' ? webMercatorToWgs84 : israelTmToWgs84;
  if (normalized.type === 'FeatureCollection') {
    normalized.features?.forEach(feature => updateGeometryCoordinates(feature.geometry, transform));
  } else if (normalized.type === 'Feature') {
    updateGeometryCoordinates(normalized.geometry, transform);
  } else {
    updateGeometryCoordinates(normalized, transform);
  }
  delete normalized.crs;
  return { json: normalized, projection };
}

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
  const [pendingSignCode, setPendingSignCode] = useState('');
  const [pendingSignDesc, setPendingSignDesc] = useState('');
  const [signPickerOpen, setSignPickerOpen] = useState(false);
  const photoInputRef = useRef(null);
  const sldInputRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const [geoJsonData, setGeoJsonData]     = useState(null);
  const [geoJsonVisible, setGeoJsonVisible] = useState(true);
  const [geoJsonKey, setGeoJsonKey]       = useState(0);
  const [geoJsonMoveMode, setGeoJsonMoveMode] = useState(false);
  const [geoJsonInspectMode, setGeoJsonInspectMode] = useState(false);
  const [sldRules, setSldRules] = useState(null);
  const [sldName, setSldName] = useState('');

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

  useEffect(() => {
    if (geoJsonVisible && geoJsonData) {
      setTimeout(() => geoJsonLayerRef.current?.bringToFront(), 0);
    }
  }, [geoJsonVisible, geoJsonData]);

  useEffect(() => {
    if (geoJsonMoveMode && addMode) setAddMode(false);
  }, [geoJsonMoveMode, addMode]);

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
    setPendingSignCode('');
    setPendingSignDesc('');
    setSignPickerOpen(false);
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

  const applyGeoJsonLayer = useCallback((json, successMessage) => {
    if (!isGeoJsonObject(json)) {
      showToast('❌ קובץ GeoJSON לא תקין');
      return false;
    }
    const normalized = normalizeGeoJsonProjection(json);
    const layerData = assignGeoJsonFeatureIds(normalized.json);
    const layer = L.geoJSON(layerData);
    const bounds = layer.getBounds();
    setGeoJsonData(layerData);
    setGeoJsonVisible(true);
    setGeoJsonKey(k => k + 1);
    if (bounds.isValid()) {
      setTimeout(() => mapRef.current?.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 }), 0);
    }
    const projectionLabel = normalized.projection === 'wgs84'
      ? ''
      : normalized.projection === 'itm'
        ? ' (הומר מרשת ישראל)'
        : ' (הומר מ-Web Mercator)';
    showToast(`${successMessage}${projectionLabel}`);
    return true;
  }, [showToast]);

  const loadDefaultGeoJsonLayer = useCallback(async () => {
    try {
      const res = await fetch(DEFAULT_GEOJSON_LAYER_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      applyGeoJsonLayer(json, '✅ שכבת תמרורים נטענה');
    } catch (err) {
      showToast('❌ שגיאה בטעינת שכבת התמרורים: ' + err.message);
    }
  }, [applyGeoJsonLayer, showToast]);

  const handleSldFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rules = parseSld(text);
      setSldRules(rules);
      setSldName(file.name);
      setGeoJsonKey(k => k + 1);
      showToast(`✅ SLD נטען (${rules.length} כללים)`);
    } catch (err) {
      showToast('❌ שגיאה בקריאת SLD: ' + err.message);
    } finally {
      e.target.value = '';
    }
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
              photos: [...pendingPhotos], date, time, signCode: pendingSignCode, signNumber: pendingSignCode,
              signDesc: pendingSignDesc, key: pendingSignCode, propertyType: '', residents: '', ageGroup: '',
              tenancy: '', ownerId: '', ownerName: '' };
    } else {
      const id = getNextId();
      rec = { id, address, lat, lon, notes: pendingNotes, category: pendingStatus, photos: [...pendingPhotos],
              signCode: pendingSignCode, signNumber: pendingSignCode, signDesc: pendingSignDesc, key: pendingSignCode,
              date, time };
    }

    onSaved(rec);
    cancelAdd();
    showToast('✅ נקודה נשמרה');
  };

  const updateGeoJsonPoint = useCallback((feature, latlng) => {
    const layerId = feature?.properties?.__layerId;
    if (!layerId) return;
    setGeoJsonData(prev => prev ? updatePointFeatureCoordinates(prev, layerId, latlng.lng, latlng.lat) : prev);
    setGeoJsonKey(k => k + 1);
    showToast('✅ נקודה הוזזה');
  }, [showToast]);

  const getFeatureStyle = useCallback((feature) => ({
    ...geoJsonStyle,
    ...(getSldStyleForFeature(feature, sldRules) || {}),
  }), [sldRules]);

  const getFeaturePointStyle = useCallback((feature) => ({
    ...DEFAULT_SLD_POINT_STYLE,
    ...(getSldStyleForFeature(feature, sldRules) || {}),
  }), [sldRules]);

  const renderGeoJsonPoint = useCallback((feature, latlng) => {
    const pointStyle = getFeaturePointStyle(feature);
    const signImage = getFeatureSignImage(feature);
    const marker = L.marker(latlng, {
      icon: makeGeoJsonPointIcon(geoJsonMoveMode, pointStyle, signImage),
      draggable: geoJsonMoveMode && feature.geometry?.type === 'Point',
      keyboard: false,
    });

    if (geoJsonInspectMode) {
      marker.bindPopup(formatFeaturePopup(feature), { maxWidth: 320 });
    }

    marker.on('dragend', (event) => {
      updateGeoJsonPoint(feature, event.target.getLatLng());
    });

    return marker;
  }, [geoJsonInspectMode, geoJsonMoveMode, getFeaturePointStyle, updateGeoJsonPoint]);

  const bindGeoJsonFeature = useCallback((feature, layer) => {
    if (geoJsonInspectMode) {
      layer.bindPopup(formatFeaturePopup(feature), { maxWidth: 320 });
    }
  }, [geoJsonInspectMode]);

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-map">
      <MapContainer
        id="mapContainer"
        center={[32.965, 35.497]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
        ref={mapRef}
        className={[
          addMode ? 'map-add-cursor' : '',
          geoJsonMoveMode ? 'map-move-cursor' : '',
          geoJsonInspectMode ? 'map-inspect-cursor' : '',
        ].filter(Boolean).join(' ')}
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
            url="https://archive.gis-net.co.il/Tzfat/GIS/tiles_png/{z}/{x}/{y}.png"
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

        {geoJsonVisible && geoJsonData && (
          <GeoJSON
            key={`${geoJsonKey}-${geoJsonMoveMode}-${geoJsonInspectMode}`}
            ref={geoJsonLayerRef}
            data={geoJsonData}
            style={getFeatureStyle}
            pointToLayer={renderGeoJsonPoint}
            onEachFeature={bindGeoJsonFeature}
            eventHandlers={{ add: (e) => e.target.bringToFront() }}
          />
        )}

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
          const fid = compactId(r.id);
          const fullId = formatId(r.id);
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

      {addMode && (
        <div className="map-add-banner">
          {pendingPoint ? '✅ מיקום נבחר — מלא פרטים למטה' : '👆 לחץ על המפה לבחירת מיקום'}
        </div>
      )}
      {geoJsonMoveMode && (
        <div className="map-mode-banner map-mode-banner-move">
          גרור נקודת שכבה כדי להזיז אותה
        </div>
      )}
      {geoJsonInspectMode && (
        <div className="map-mode-banner map-mode-banner-inspect">
          לחץ על נקודה כדי לראות שדות
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
        <button
          className={`map-fab map-fab-geojson${geoJsonData && geoJsonVisible ? ' active' : ''}`}
          onClick={loadDefaultGeoJsonLayer}
          title={geoJsonData ? 'רענן שכבת תמרורים' : 'טען שכבת תמרורים'}
        >🗺️</button>
        {geoJsonData && (
          <button
            className={`map-fab map-fab-geojson-toggle${geoJsonVisible ? ' active' : ''}`}
            onClick={() => setGeoJsonVisible(v => !v)}
            title={geoJsonVisible ? 'הסתר שכבה' : 'הצג שכבה'}
          >👁️</button>
        )}
        {geoJsonData && geoJsonVisible && (
          <button
            className={`map-fab map-fab-geojson-move${geoJsonMoveMode ? ' active' : ''}`}
            onClick={() => {
              setGeoJsonMoveMode(v => !v);
              setGeoJsonInspectMode(false);
            }}
            title={geoJsonMoveMode ? 'בטל הזזת נקודות' : 'הזז נקודות שכבה'}
          >↔️</button>
        )}
        {geoJsonData && geoJsonVisible && (
          <button
            className={`map-fab map-fab-geojson-inspect${geoJsonInspectMode ? ' active' : ''}`}
            onClick={() => {
              setGeoJsonInspectMode(v => !v);
              setGeoJsonMoveMode(false);
            }}
            title={geoJsonInspectMode ? 'בטל בדיקת נקודות' : 'בדיקת נקודות'}
          >ℹ️</button>
        )}
        {geoJsonData && (
          <button
            className={`map-fab map-fab-sld${sldRules ? ' active' : ''}`}
            onClick={() => sldInputRef.current?.click()}
            title={sldRules ? `SLD פעיל: ${sldName}` : 'טען SLD'}
          >🎨</button>
        )}
        {sldRules && (
          <button
            className="map-fab map-fab-sld-clear"
            onClick={() => {
              setSldRules(null);
              setSldName('');
              setGeoJsonKey(k => k + 1);
              showToast('סימבולוגיה הוסרה');
            }}
            title="הסר סימבולוגיה"
          >✕</button>
        )}
      </div>

      <input
        ref={sldInputRef}
        type="file"
        accept=".sld,.xml"
        onChange={handleSldFile}
        style={{ display: 'none' }}
      />

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

          <div className="map-add-chips-label">סוג תמרור</div>
          {pendingSignCode ? (
            <div className="sign-selected-row map-add-sign-selected">
              <div className="sign-selected-icon">
                {(() => {
                  const sign = SIGNS.find(x => x.code === pendingSignCode);
                  return sign ? <img src={sign.img} alt={pendingSignCode} /> : null;
                })()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="sign-selected-label">{pendingSignCode}</span>
                {pendingSignDesc && (
                  <div className="map-add-sign-desc">{pendingSignDesc}</div>
                )}
              </div>
              <button className="sign-change-btn" onClick={() => setSignPickerOpen(true)}>שנה</button>
              <button
                className="sign-clear-btn"
                onClick={() => {
                  setPendingSignCode('');
                  setPendingSignDesc('');
                }}
              >✕</button>
            </div>
          ) : (
            <button className="sign-pick-btn map-add-sign-pick" onClick={() => setSignPickerOpen(true)}>
              בחר סוג תמרור…
            </button>
          )}

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
      <SignPicker
        open={signPickerOpen}
        onSelect={(code, desc) => {
          setPendingSignCode(code);
          setPendingSignDesc(desc || '');
        }}
        onClose={() => setSignPickerOpen(false)}
      />
    </div>
  );
}
