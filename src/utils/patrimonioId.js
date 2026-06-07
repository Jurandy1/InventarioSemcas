/** Normaliza tombo/patrimônio para comparação (ex.: 14000023 → 014000023). */
export function normalizePatrimonioId(id) {
  const raw = String(id ?? "").trim();
  if (!raw) return "";
  if (/^(ST_|MAN_|sess_)/i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length >= 5 && digits.length <= 9) return digits.padStart(9, "0");
  return digits;
}

export function patrimonioIdsMatch(a, b) {
  return normalizePatrimonioId(a) === normalizePatrimonioId(b);
}

export function getFoundEntry(itemId, foundMap) {
  if (!foundMap || itemId == null) return null;
  const key = normalizePatrimonioId(itemId);
  return foundMap[key] || foundMap[String(itemId)] || null;
}

export function isItemInventariado(itemId, foundSet) {
  if (!foundSet || itemId == null) return false;
  const key = normalizePatrimonioId(itemId);
  return foundSet.has(key) || foundSet.has(String(itemId));
}
