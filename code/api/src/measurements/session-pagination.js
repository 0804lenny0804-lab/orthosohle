const ID = /^[0-9a-f-]{36}$/i;
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;

export function validTime(value) {
  if (typeof value !== 'string' || !UTC.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const canonical = new Date(Date.parse(value)).toISOString();
  return value === canonical || value === canonical.replace('.000Z', 'Z');
}

export function pagination(query) {
  const limitText = query.limit ?? '50';
  const limit = Number(limitText);
  let before = null;
  if (query.before !== undefined) {
    try { before = JSON.parse(query.before); } catch { return null; }
  }
  if (!/^\d{1,2}$/.test(String(limitText)) || !Number.isInteger(limit) || limit < 1 || limit > 50 ||
    (before !== null && (!before || typeof before !== 'object' || Array.isArray(before) ||
      Object.keys(before).sort().join(',') !== 'id,startedAt' || !validTime(before.startedAt) || !ID.test(before.id)))) {
    return null;
  }
  if (before) before.startedAt = new Date(before.startedAt).toISOString();
  return { before, limit };
}
