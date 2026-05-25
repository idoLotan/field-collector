export function formatId(id) {
  if (typeof id === 'number') return 'FC-' + String(id).padStart(3, '0');
  return id;
}

export function shortId(id) {
  if (id == null) return '';
  if (typeof id === 'number') return String(id);
  const parts = String(id).split('-');
  return parts[parts.length - 1] || String(id);
}

export function compactId(id) {
  if (id == null) return '';
  if (typeof id === 'number') return String(id);
  const parts = String(id).split('-');
  // Return last two parts separated by dash: "270-4ut"
  if (parts.length >= 2) {
    return parts[parts.length - 2] + '-' + parts[parts.length - 1];
  }
  return parts[parts.length - 1] || String(id);
}

export function escRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildStreetMap(pairs) {
  const map = {};
  for (const { street, house } of pairs) {
    if (!map[street]) map[street] = [];
    if (!map[street].includes(house)) map[street].push(house);
  }
  for (const s in map) {
    map[s].sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b);
    });
  }
  return map;
}

export function sortedStreets(map) {
  return Object.keys(map).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}
