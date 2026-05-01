import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { loadOwners, persistOwners, clearOwners } from '../utils/storage';

/* Parse uploaded Excel/CSV into owner objects.
   Accepts Hebrew or English column headers. */
function parseOwnerSheet(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (!rows.length) return [];

  const normalize = (s) => String(s || '').trim();
  const col = (row, ...keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(h => h.trim() === k);
      if (found !== undefined) return normalize(row[found]);
    }
    return '';
  };

  return rows
    .map(r => ({
      id:        col(r, 'תעודת זהות', 'ת.ז.', 'tz', 'id', 'ID'),
      firstName: col(r, 'שם פרטי', 'firstname', 'first_name', 'שם'),
      lastName:  col(r, 'שם משפחה', 'lastname', 'last_name'),
      address:   col(r, 'רחוב', 'כתובת', 'address'),
      house:     col(r, 'מספר בית', 'בית', 'house'),
      apartment: col(r, 'דירה', 'apartment'),
    }))
    .filter(o => o.id || o.firstName || o.lastName);
}

function fullName(o) {
  return [o.firstName, o.lastName].filter(Boolean).join(' ');
}

export default function OwnerField({ ownerId, ownerName, onChange, showToast }) {
  const [owners, setOwners]         = useState(() => loadOwners());
  const [query, setQuery]           = useState(ownerName || '');
  const [suggestions, setSuggestions] = useState([]);
  const [manualId, setManualId]     = useState(ownerId || '');
  const [mode, setMode]             = useState('search'); // 'search' | 'manual'
  const fileRef                     = useRef(null);
  const inputRef                    = useRef(null);

  // sync outward when ownerName / ownerId reset by parent
  useEffect(() => { setQuery(ownerName || ''); setManualId(ownerId || ''); }, [ownerName, ownerId]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const parsed = parseOwnerSheet(wb);
        if (!parsed.length) { showToast('⚠️ לא נמצאו שורות בקובץ.'); return; }
        persistOwners(parsed);
        setOwners(parsed);
        showToast(`✅ נטענו ${parsed.length} רשומות בעלי דירות.`);
      } catch {
        showToast('❌ שגיאה בקריאת הקובץ.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleQuery = (val) => {
    setQuery(val);
    if (!val.trim()) { setSuggestions([]); onChange('', ''); return; }
    const q = val.toLowerCase();
    const matches = owners
      .filter(o =>
        o.id.startsWith(val) ||
        fullName(o).toLowerCase().includes(q)
      )
      .slice(0, 6);
    setSuggestions(matches);
    // if user is typing a raw ID/name without selecting, clear linked data
    onChange('', val);
  };

  const select = (o) => {
    const name = fullName(o);
    setQuery(name);
    setManualId(o.id);
    setSuggestions([]);
    onChange(o.id, name);
  };

  const clear = () => {
    setQuery(''); setManualId(''); setSuggestions([]);
    onChange('', '');
  };

  const handleManualChange = (field, val) => {
    if (field === 'id')   { setManualId(val);  onChange(val, query); }
    if (field === 'name') { setQuery(val);      onChange(manualId, val); }
  };

  const clearList = () => {
    clearOwners(); setOwners([]);
    showToast('🗑 רשימת בעלי הדירות נמחקה.');
  };

  return (
    <div className="owner-field">
      {/* Header row: label + upload + clear list */}
      <div className="owner-header">
        <span className="owner-title">🏠 פרטי בעל/ת הדירה</span>
        <div className="owner-header-actions">
          <button className="owner-upload-btn" onClick={() => fileRef.current?.click()}>
            📂 {owners.length ? `רשימה (${owners.length})` : 'טען רשימה'}
          </button>
          {owners.length > 0 && (
            <button className="owner-clear-list" onClick={clearList} title="מחק רשימה">✕</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={handleUpload} />
      </div>

      {/* Mode toggle */}
      <div className="owner-mode-row">
        <button
          className={`owner-mode-btn${mode === 'search' ? ' active' : ''}`}
          onClick={() => setMode('search')}
        >חיפוש מרשימה</button>
        <button
          className={`owner-mode-btn${mode === 'manual' ? ' active' : ''}`}
          onClick={() => setMode('manual')}
        >הזנה ידנית</button>
      </div>

      {mode === 'search' ? (
        <div className="owner-search-wrap">
          {owners.length === 0 && (
            <div className="owner-no-list">טען קובץ Excel/CSV עם רשימת הדיירים תחילה.</div>
          )}
          {owners.length > 0 && (
            <div className="owner-input-row">
              <input
                ref={inputRef}
                className="owner-input"
                type="text"
                placeholder="חפש לפי שם או ת.ז.…"
                value={query}
                onChange={e => handleQuery(e.target.value)}
                autoComplete="off"
              />
              {(query || ownerId) && (
                <button className="owner-clear-btn" onClick={clear}>✕</button>
              )}
            </div>
          )}
          {suggestions.length > 0 && (
            <ul className="owner-suggestions">
              {suggestions.map((o, i) => (
                <li key={i} onClick={() => select(o)}>
                  <span className="owner-sug-name">{fullName(o)}</span>
                  <span className="owner-sug-id">{o.id}</span>
                  {o.address && <span className="owner-sug-addr">{o.address} {o.house}{o.apartment ? `/${o.apartment}` : ''}</span>}
                </li>
              ))}
            </ul>
          )}
          {/* Show selected */}
          {ownerId && !suggestions.length && (
            <div className="owner-selected">
              <span>✓ {ownerName}</span>
              <span className="owner-selected-id">ת.ז. {ownerId}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="owner-manual">
          <input
            className="owner-input"
            type="text"
            placeholder="שם מלא…"
            value={query}
            onChange={e => handleManualChange('name', e.target.value)}
          />
          <input
            className="owner-input"
            type="text"
            inputMode="numeric"
            placeholder="תעודת זהות (9 ספרות)…"
            value={manualId}
            onChange={e => handleManualChange('id', e.target.value)}
            maxLength={9}
          />
        </div>
      )}
    </div>
  );
}
