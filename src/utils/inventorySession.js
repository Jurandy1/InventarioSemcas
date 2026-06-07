const SESSION_KEY = "inv-session-id";

export function createSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getSessionId() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function setSessionId(id) {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(SESSION_KEY, id);
  } catch {}
}

export function clearSessionId() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function filterLocaisForSession(locais, sessionId, activeUnitIds = []) {
  if (!sessionId) return [];
  const unitSet = new Set(activeUnitIds || []);
  return (locais || []).filter((l) => {
    if (l.sessionId !== sessionId) return false;
    const ids = Array.isArray(l.unidadeIds) ? l.unidadeIds : l.unidadeId ? [l.unidadeId] : [];
    if (!ids.length) return true;
    return ids.some((uid) => unitSet.has(uid));
  });
}

export function countFoundInLocal(foundMap, localId, activeUnitIds = []) {
  const unitSet = new Set(activeUnitIds || []);
  let n = 0;
  for (const id in foundMap || {}) {
    const f = foundMap[id];
    if (!f || f.localId !== localId) continue;
    if (unitSet.size && f.unidadeId && !unitSet.has(f.unidadeId)) continue;
    n++;
  }
  return n;
}
