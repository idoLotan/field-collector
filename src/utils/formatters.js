export function formatId(n) {
  return 'FC-' + String(n).padStart(3, '0');
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
