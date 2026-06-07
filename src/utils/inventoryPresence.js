import { fsDel, fsGetAll, fsSet } from "../services/firebase.js";
import { getFirebaseSession } from "../services/firebase.js";

const STALE_MS = 3 * 60 * 1000;

export async function pingInventoryPresence({ uid, nome, email, unidadeIds = [] }) {
  if (!uid) return;
  const ids = Array.isArray(unidadeIds) ? unidadeIds.filter(Boolean) : [];
  await fsSet("presenca_inventario", uid, {
    uid,
    nome: nome || "",
    email: email || "",
    unidadeIds: ids,
    ultimoPing: new Date().toISOString(),
  });
}

export async function clearInventoryPresence(uid) {
  if (!uid) return;
  try {
    await fsDel("presenca_inventario", uid);
  } catch {}
}

export async function loadActiveInventors(unidadeIds = [], { excludeUid = "" } = {}) {
  const ids = new Set(Array.isArray(unidadeIds) ? unidadeIds.filter(Boolean) : []);
  if (!ids.size) return [];

  let docs = [];
  try {
    docs = await fsGetAll("presenca_inventario", { pageSize: 100 });
  } catch {
    return [];
  }

  const now = Date.now();
  const out = [];
  for (const d of docs) {
    if (d.uid === excludeUid) continue;
    const ping = d.ultimoPing ? new Date(d.ultimoPing).getTime() : 0;
    if (!ping || now - ping > STALE_MS) continue;
    const units = Array.isArray(d.unidadeIds) ? d.unidadeIds : [];
    if (!units.some((uid) => ids.has(uid))) continue;
    out.push({
      uid: d.uid,
      nome: d.nome || d.email || "Inventariante",
      ultimoPing: d.ultimoPing,
    });
  }
  return out.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export function collectRecentInventors(foundMap, unidadeIds = [], windowMs = 60 * 60 * 1000) {
  const ids = new Set(Array.isArray(unidadeIds) ? unidadeIds.filter(Boolean) : []);
  const cutoff = Date.now() - windowMs;
  const users = new Map();
  for (const key in foundMap || {}) {
    const f = foundMap[key];
    if (!f) continue;
    if (ids.size && f.unidadeId && !ids.has(f.unidadeId)) continue;
    const ts = f.ultimaAtualizacao ? new Date(f.ultimaAtualizacao).getTime() : 0;
    if (ts < cutoff) continue;
    const u = String(f.usuario || f.user || "").trim();
    if (!u || u.toUpperCase() === "COORDENADORA") continue;
    users.set(u, Math.max(users.get(u) || 0, ts));
  }
  return [...users.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome]) => nome);
}
