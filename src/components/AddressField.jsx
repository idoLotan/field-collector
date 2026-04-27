import { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { buildStreetMap, sortedStreets, escRegex } from '../utils/formatters';
import { persistAddrPairs } from '../utils/storage';

function HighlightedText({ text, query }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escRegex(query.trim())})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : part
      )}
    </>
  );
}

export default function AddressField({
  mode, onModeChange,
  selectedStreet, selectedHouse,
  streetInput, onStreetInput,
  onStreetPick, onHousePick,
  freeText, onFreeTextChange,
  addrPairs, onAddrPairsChange,
  showToast,
  compact = false,
}) {
  const [streetOpen, setStreetOpen] = useState(false);
  const [streetHlIdx, setStreetHlIdx] = useState(-1);
  const [houseOpen, setHouseOpen] = useState(false);
  const streetWrapRef = useRef(null);
  const houseWrapRef = useRef(null);
  const fileInputRef = useRef(null);

  const streetMap = buildStreetMap(addrPairs);
  const allStreets = sortedStreets(streetMap);

  const filteredStreets = streetInput
    ? allStreets.filter(s => s.toLowerCase().includes(streetInput.toLowerCase()))
    : allStreets;

  const housesForStreet = selectedStreet
    ? (streetMap[selectedStreet] || [])
    : [...new Set(
        Object.values(streetMap).flat()
          .sort((a, b) => {
            const na = parseInt(a), nb = parseInt(b);
            return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b);
          })
      )];

  const addrValue = mode === 'free'
    ? freeText
    : selectedStreet && selectedHouse
      ? `${selectedStreet} ${selectedHouse}`
      : selectedStreet || '';

  useEffect(() => {
    const handler = (e) => {
      if (!streetWrapRef.current?.contains(e.target)) setStreetOpen(false);
      if (!houseWrapRef.current?.contains(e.target)) setHouseOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, []);

  const handleStreetInput = (val) => {
    onStreetInput(val);
    if (allStreets.length) setStreetOpen(true);
    setStreetHlIdx(-1);
  };

  const handleArrowBtn = () => {
    if (streetOpen) { setStreetOpen(false); return; }
    if (!allStreets.length) { showToast('ℹ️ לא נטענה רשימת כתובות עדיין.'); return; }
    setStreetOpen(true);
  };

  const pickStreet = (street) => {
    onStreetPick(street);
    setStreetOpen(false);
    setStreetHlIdx(-1);
    setHouseOpen(false);
  };

  const handleStreetKeyDown = (e) => {
    const items = filteredStreets;
    if (!streetOpen || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setStreetHlIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setStreetHlIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && streetHlIdx >= 0) { e.preventDefault(); pickStreet(items[streetHlIdx]); }
    else if (e.key === 'Escape') setStreetOpen(false);
  };

  const toggleHouseList = () => {
    if (houseOpen) { setHouseOpen(false); return; }
    if (!housesForStreet.length) { showToast('ℹ️ בחר רחוב תחילה.'); return; }
    setHouseOpen(true);
  };

  const pickHouse = (h) => {
    onHousePick(h);
    setHouseOpen(false);
  };

  const loadAddressFile = (input) => {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!rows.length) { showToast('⚠️ הקובץ נראה ריק.'); return; }

        let startRow = 0;
        const headerWords = /street|road|שם|רחוב|address|house|number|בית|מס|col/i;
        if (headerWords.test(String(rows[0][0] || '')) || headerWords.test(String(rows[0][1] || ''))) {
          startRow = 1;
        }

        const pairs = [];
        for (let i = startRow; i < rows.length; i++) {
          const street = String(rows[i][0] || '').trim();
          const house  = String(rows[i][1] || '').trim();
          if (street && house) pairs.push({ street, house });
        }

        if (!pairs.length) { showToast('⚠️ לא נמצאו זוגות רחוב+מספר. בדוק עמודות A ו-B.'); return; }

        persistAddrPairs(pairs);
        onAddrPairsChange(pairs);
        const streetCount = new Set(pairs.map(p => p.street)).size;
        showToast(`✅ נטענו ${pairs.length} שורות (${streetCount} רחובות)`);
      } catch (err) {
        showToast('❌ לא ניתן לקרוא את הקובץ: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearAddressList = () => {
    persistAddrPairs([]);
    onAddrPairsChange([]);
    onStreetPick('');
    onHousePick('');
    showToast('🗑 רשימת הכתובות נוקתה.');
  };

  const addrBadge = addrPairs.length
    ? `${new Set(addrPairs.map(p => p.street)).size} רחובות · ${addrPairs.length} שורות`
    : 'לא נטענה רשימת כתובות';

  return (
    <div className={compact ? 'field-compact' : 'field'}>
      {!compact && <label>כתובת <span>📍</span></label>}
      {!compact && (
        <div className="addr-mode-tabs">
          <button className={`mode-btn${mode === 'list' ? ' active' : ''}`} onClick={() => onModeChange('list')}>📋 רחוב + מספר</button>
          <button className={`mode-btn${mode === 'free' ? ' active' : ''}`} onClick={() => onModeChange('free')}>✏️ טקסט חופשי</button>
        </div>
      )}

      {mode === 'list' && (
        <div id="modeList">
          <div className="street-house-row">
            <div className="street-wrap" ref={streetWrapRef}>
              <div className="street-input-row">
                <input
                  type="text"
                  id="fStreet"
                  value={streetInput}
                  placeholder="חפש רחוב…"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={e => handleStreetInput(e.target.value)}
                  onKeyDown={handleStreetKeyDown}
                  onFocus={() => allStreets.length && setStreetOpen(true)}
                />
                <button className="combo-arrow" onClick={handleArrowBtn} title="הצג כל הרחובות">▾</button>
              </div>
              {streetOpen && (
                <ul className="combo-list open" id="streetList">
                  {filteredStreets.length > 0
                    ? filteredStreets.map((s, i) => (
                        <li
                          key={s}
                          className={i === streetHlIdx ? 'hl' : ''}
                          onClick={() => pickStreet(s)}
                        >
                          <HighlightedText text={s} query={streetInput} />
                        </li>
                      ))
                    : <li className="combo-empty">לא נמצאו תוצאות — ניתן להקליד חופשי</li>
                  }
                </ul>
              )}
            </div>

            <div className="house-wrap" ref={houseWrapRef}>
              <button
                className={`house-btn${houseOpen ? ' active' : ''}`}
                id="houseBtn"
                onClick={toggleHouseList}
                title="מספר בית"
              >
                <span className="hb-label">{selectedHouse || 'מס׳'}</span>
                <span className="hb-arrow">▾</span>
              </button>
              {houseOpen && (
                <ul className="combo-list open" id="houseList">
                  {housesForStreet.map(h => (
                    <li key={h} onClick={() => pickHouse(h)}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={`addr-preview${addrValue ? '' : ' empty'}`} id="addrPreview">
            {addrValue ? `📍 ${addrValue}` : 'בחר רחוב ומספר בית'}
          </div>
        </div>
      )}

      {mode === 'free' && (
        <div id="modeFree">
          <input
            type="text"
            id="fAddressFree"
            value={freeText}
            placeholder="הכנס כתובת מלאה…"
            autoComplete="street-address"
            onChange={e => onFreeTextChange(e.target.value)}
          />
        </div>
      )}

      <div className="addr-list-strip">
        <span className={`addr-badge${addrPairs.length ? '' : ' empty'}`}>
          {addrBadge}
        </span>
        <button className="btn-load" onClick={() => fileInputRef.current.click()}>
          📂 טען קובץ
        </button>
        {addrPairs.length > 0 && (
          <button className="btn-clear-list" onClick={clearAddressList}>
            ✕ נקה נתונים
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={e => loadAddressFile(e.target)}
      />
    </div>
  );
}
