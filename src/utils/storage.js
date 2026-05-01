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

// ── Survey (population) storage ──
const SURVEY_RECORDS_KEY = 'fieldcollector_survey_records';
const SURVEY_COUNTER_KEY = 'fieldcollector_survey_counter';
const SURVEY_DRAFT_KEY   = 'fieldcollector_survey_draft';

export function loadSurveyRecords()      { try { return JSON.parse(localStorage.getItem(SURVEY_RECORDS_KEY) || '[]'); } catch { return []; } }
export function persistSurveyRecords(r)  { localStorage.setItem(SURVEY_RECORDS_KEY, JSON.stringify(r)); }

export function getSurveyNextId() {
  const n = (parseInt(localStorage.getItem(SURVEY_COUNTER_KEY) || '0') || 0) + 1;
  localStorage.setItem(SURVEY_COUNTER_KEY, String(n));
  return n;
}

export function loadSurveyDraft()     { try { return JSON.parse(localStorage.getItem(SURVEY_DRAFT_KEY) || 'null'); } catch { return null; } }
export function persistSurveyDraft(d) { try { localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(d)); } catch {} }
export function clearSurveyDraft()    { localStorage.removeItem(SURVEY_DRAFT_KEY); }

// ── Drainage storage ──
const DRAINAGE_RECORDS_KEY = 'fieldcollector_drainage_records';
const DRAINAGE_COUNTER_KEY = 'fieldcollector_drainage_counter';
const DRAINAGE_DRAFT_KEY   = 'fieldcollector_drainage_draft';

export function loadDrainageRecords()      { try { return JSON.parse(localStorage.getItem(DRAINAGE_RECORDS_KEY) || '[]'); } catch { return []; } }
export function persistDrainageRecords(r)  { localStorage.setItem(DRAINAGE_RECORDS_KEY, JSON.stringify(r)); }

export function getDrainageNextId() {
  const n = (parseInt(localStorage.getItem(DRAINAGE_COUNTER_KEY) || '0') || 0) + 1;
  localStorage.setItem(DRAINAGE_COUNTER_KEY, String(n));
  return n;
}

export function loadDrainageDraft()     { try { return JSON.parse(localStorage.getItem(DRAINAGE_DRAFT_KEY) || 'null'); } catch { return null; } }
export function persistDrainageDraft(d) { try { localStorage.setItem(DRAINAGE_DRAFT_KEY, JSON.stringify(d)); } catch {} }
export function clearDrainageDraft()    { localStorage.removeItem(DRAINAGE_DRAFT_KEY); }

// ── Owners list (uploaded population table) ──
const OWNERS_KEY = 'fieldcollector_owners';
export function loadOwners()      { try { return JSON.parse(localStorage.getItem(OWNERS_KEY) || '[]'); } catch { return []; } }
export function persistOwners(o)  { localStorage.setItem(OWNERS_KEY, JSON.stringify(o)); }
export function clearOwners()     { localStorage.removeItem(OWNERS_KEY); }
