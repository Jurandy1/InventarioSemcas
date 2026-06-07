import { normalizePatrimonioId } from "./patrimonioId.js";

export const SESSION_KEY = "inv-session-id";
export const SESSOES_PAUSADAS_KEY = "inv-sessoes-pausadas";

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

export function filterLocaisForSession(locais, sessionId, activeUnitIds = [], foundMap = null) {
  const unitSet = new Set(activeUnitIds || []);
  const referencedLocalIds = new Set();
  if (foundMap && unitSet.size) {
    for (const id in foundMap) {
      const f = foundMap[id];
      if (!f?.localId) continue;
      if (f.unidadeId && !unitSet.has(f.unidadeId)) continue;
      referencedLocalIds.add(f.localId);
    }
  }
  return (locais || []).filter((l) => {
    const lid = l.id || l._id;
    if (referencedLocalIds.has(lid)) return true;
    const ids = Array.isArray(l.unidadeIds) ? l.unidadeIds : l.unidadeId ? [l.unidadeId] : [];
    const unitMatch = !unitSet.size || !ids.length || ids.some((uid) => unitSet.has(uid));
    if (!unitMatch) return false;
    if (unitSet.size > 0) return true;
    if (!sessionId) return false;
    return l.sessionId === sessionId;
  });
}

export function loadSessoesPausadas() {
  try {
    return JSON.parse(localStorage.getItem(SESSOES_PAUSADAS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSessoesPausadas(list) {
  try {
    localStorage.setItem(SESSOES_PAUSADAS_KEY, JSON.stringify(list || []));
  } catch {}
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

/** Unidade correta do item (multi-unidade: não usar só a primeira ativa). */
export function resolveUnitForItem(item, unidadesAtivas = [], fallback = null) {
  if (!item) return fallback || null;
  const uid = item.unidadeId;
  if (uid) {
    const hit = unidadesAtivas.find((u) => u.id === uid);
    if (hit) return hit;
    return { id: uid, nome: item.unidadeNome || "" };
  }
  return fallback || null;
}

/** Mescla registros de inventário sem perder dados locais ou itens fora da query filtrada. */
export function mergeFoundRecords(prev = [], incoming = [], options = {}) {
  const keepIds = options.keepItemIds ? new Set(options.keepItemIds) : null;
  const itemUnits = options.itemUnits || null;
  const mergedMap = new Map();

  for (const p of prev) {
    const id = normalizePatrimonioId(p.patrimonioId || p._id);
    if (id) mergedMap.set(id, p);
  }

  for (const n of incoming) {
    const id = normalizePatrimonioId(n.patrimonioId || n._id);
    if (!id) continue;
    const old = mergedMap.get(id);
    if (!old) {
      mergedMap.set(id, n);
      continue;
    }
    const oldTs = old.ultimaAtualizacao ? new Date(old.ultimaAtualizacao).getTime() : 0;
    const newTs = n.ultimaAtualizacao ? new Date(n.ultimaAtualizacao).getTime() : 0;
    if (newTs >= oldTs) mergedMap.set(id, n);
  }

  if (keepIds?.size) {
    for (const p of prev) {
      const id = normalizePatrimonioId(p.patrimonioId || p._id);
      if (id && keepIds.has(id) && !mergedMap.has(id)) mergedMap.set(id, p);
      else if (id) {
        for (const keepId of keepIds) {
          if (normalizePatrimonioId(keepId) === id && !mergedMap.has(id)) {
            mergedMap.set(id, p);
            break;
          }
        }
      }
    }
  }

  const result = [];
  for (const entry of mergedMap.values()) {
    const id = normalizePatrimonioId(entry.patrimonioId || entry._id);
    if (itemUnits && id && itemUnits.has(id)) {
      const u = itemUnits.get(id);
      if (!entry.unidadeId && u?.unidadeId) {
        result.push({ ...entry, unidadeId: u.unidadeId, unidadeNome: u.unidadeNome || entry.unidadeNome || "" });
        continue;
      }
    }
    result.push(entry);
  }
  return result;
}
