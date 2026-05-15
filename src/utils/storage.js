const RECORDS_KEY = 'fieldcollector_records';
const ADDRS_KEY   = 'fieldcollector_addresses';
const DRAFT_KEY   = 'fieldcollector_draft';

export function generateId() {
  const now = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const p3 = n => String(n).padStart(3, '0');
  const date = `${now.getFullYear()}${p2(now.getMonth()+1)}${p2(now.getDate())}`;
  const time = `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
  const ms   = p3(now.getMilliseconds());
  const rand = Math.random().toString(36).slice(2, 5);
  return `${date}-${time}-${ms}-${rand}`;
}

export function loadRecords()     { try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); } catch { return []; } }
export function persistRecords(r) { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); }
export function loadAddrPairs()   { try { return JSON.parse(localStorage.getItem(ADDRS_KEY)   || '[]'); } catch { return []; } }
export function persistAddrPairs(a){ localStorage.setItem(ADDRS_KEY, JSON.stringify(a)); }

export function getNextId() { return generateId(); }

export function loadDraft()      { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } }
export function persistDraft(d)  { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} }
export function clearDraft()     { localStorage.removeItem(DRAFT_KEY); }

// ── Survey (population) storage ──
const SURVEY_RECORDS_KEY = 'fieldcollector_survey_records';
const SURVEY_DRAFT_KEY   = 'fieldcollector_survey_draft';

export function loadSurveyRecords()      { try { return JSON.parse(localStorage.getItem(SURVEY_RECORDS_KEY) || '[]'); } catch { return []; } }
export function persistSurveyRecords(r)  { localStorage.setItem(SURVEY_RECORDS_KEY, JSON.stringify(r)); }

export function getSurveyNextId() { return generateId(); }

export function loadSurveyDraft()     { try { return JSON.parse(localStorage.getItem(SURVEY_DRAFT_KEY) || 'null'); } catch { return null; } }
export function persistSurveyDraft(d) { try { localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(d)); } catch {} }
export function clearSurveyDraft()    { localStorage.removeItem(SURVEY_DRAFT_KEY); }

// ── Drainage storage ──
const DRAINAGE_RECORDS_KEY = 'fieldcollector_drainage_records';
const DRAINAGE_DRAFT_KEY   = 'fieldcollector_drainage_draft';

export function loadDrainageRecords()      { try { return JSON.parse(localStorage.getItem(DRAINAGE_RECORDS_KEY) || '[]'); } catch { return []; } }
export function persistDrainageRecords(r)  { localStorage.setItem(DRAINAGE_RECORDS_KEY, JSON.stringify(r)); }

export function getDrainageNextId() { return generateId(); }

export function loadDrainageDraft()     { try { return JSON.parse(localStorage.getItem(DRAINAGE_DRAFT_KEY) || 'null'); } catch { return null; } }
export function persistDrainageDraft(d) { try { localStorage.setItem(DRAINAGE_DRAFT_KEY, JSON.stringify(d)); } catch {} }
export function clearDrainageDraft()    { localStorage.removeItem(DRAINAGE_DRAFT_KEY); }

// ── Owners list (uploaded population table) ──
const OWNERS_KEY = 'fieldcollector_owners';
export function loadOwners()      { try { return JSON.parse(localStorage.getItem(OWNERS_KEY) || '[]'); } catch { return []; } }
export function persistOwners(o)  { localStorage.setItem(OWNERS_KEY, JSON.stringify(o)); }
export function clearOwners()     { localStorage.removeItem(OWNERS_KEY); }
