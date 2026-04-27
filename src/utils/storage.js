const RECORDS_KEY = 'fieldcollector_records';
const ADDRS_KEY   = 'fieldcollector_addresses';
const COUNTER_KEY = 'fieldcollector_counter';
const DRAFT_KEY   = 'fieldcollector_draft';

export function loadRecords()     { try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); } catch { return []; } }
export function persistRecords(r) { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); }
export function loadAddrPairs()   { try { return JSON.parse(localStorage.getItem(ADDRS_KEY)   || '[]'); } catch { return []; } }
export function persistAddrPairs(a){ localStorage.setItem(ADDRS_KEY, JSON.stringify(a)); }

export function getNextId() {
  const n = (parseInt(localStorage.getItem(COUNTER_KEY) || '0') || 0) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return n;
}

export function loadDraft()      { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } }
export function persistDraft(d)  { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} }
export function clearDraft()     { localStorage.removeItem(DRAFT_KEY); }
