import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDS_FILE = path.join(__dirname, 'records.json');

function ensureFile() {
  if (!fs.existsSync(RECORDS_FILE)) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify({ records: [], lastUpdated: new Date().toISOString() }, null, 2));
  }
}

export function getAllRecords() {
  ensureFile();
  try {
    const data = fs.readFileSync(RECORDS_FILE, 'utf-8');
    return JSON.parse(data).records || [];
  } catch (err) {
    console.error('Error reading records:', err);
    return [];
  }
}

export function saveRecords(records) {
  ensureFile();
  try {
    const data = {
      records: records || [],
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(data, null, 2));
    return { success: true, count: records.length };
  } catch (err) {
    console.error('Error saving records:', err);
    throw err;
  }
}

export function addRecords(newRecords) {
  const existing = getAllRecords();
  const merged = [...existing];
  
  for (const newRecord of newRecords) {
    const existingIndex = merged.findIndex(r => r.id === newRecord.id);
    if (existingIndex >= 0) {
      merged[existingIndex] = newRecord; // Update if exists
    } else {
      merged.push(newRecord); // Add if new
    }
  }
  
  saveRecords(merged);
  return { success: true, count: merged.length, added: newRecords.length };
}
