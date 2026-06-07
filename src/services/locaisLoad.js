import { fsGetAll, fsGetDoc } from "./firebase.js";

export function normalizeLocalRecord(entry) {
  if (!entry) return entry;
  const id = entry.id || entry._id;
  const unidadeIds = Array.isArray(entry.unidadeIds)
    ? entry.unidadeIds.filter(Boolean)
    : entry.unidadeId
      ? [entry.unidadeId]
      : [];
  return { ...entry, id, _id: id || entry._id, unidadeIds };
}

export function mergeLocaisRecords(prev = [], incoming = []) {
  const map = new Map();
  for (const p of prev || []) {
    const norm = normalizeLocalRecord(p);
    const id = norm.id || norm._id;
    if (id) map.set(id, norm);
  }
  for (const n of incoming || []) {
    const norm = normalizeLocalRecord(n);
    const id = norm.id || norm._id;
    if (!id) continue;
    const old = map.get(id);
    if (!old) {
      map.set(id, norm);
      continue;
    }
    map.set(id, { ...old, ...norm, unidadeIds: [...new Set([...(old.unidadeIds || []), ...(norm.unidadeIds || [])])] });
  }
  return [...map.values()];
}

async function fetchLocaisByUnit(uid) {
  const [byArray, byLegacy] = await Promise.all([
    fsGetAll("locais", {
      where: [{ field: "unidadeIds", op: "ARRAY_CONTAINS", value: uid }],
      pageSize: 150,
    }),
    fsGetAll("locais", {
      where: [{ field: "unidadeId", op: "EQUAL", value: uid }],
      pageSize: 150,
    }),
  ]);
  return [...byArray, ...byLegacy];
}

/** Carrega locais por unidade (inclui campo legado unidadeId) e por IDs conhecidos. */
export async function fetchLocaisForUnits(unitIds = [], options = {}) {
  const ids = Array.isArray(unitIds) ? unitIds.filter(Boolean) : [];
  const localIds = [...new Set((options.localIds || []).filter(Boolean))];

  let fromQuery = [];
  if (ids.length === 0) {
    fromQuery = await fsGetAll("locais", { pageSize: 250 });
  } else if (ids.length === 1) {
    fromQuery = await fetchLocaisByUnit(ids[0]);
  } else {
    const chunks = await Promise.all(ids.map(fetchLocaisByUnit));
    const seen = new Set();
    for (const chunk of chunks) {
      for (const d of chunk) {
        const lid = d._id || d.id;
        if (!lid || seen.has(lid)) continue;
        seen.add(lid);
        fromQuery.push(d);
      }
    }
  }

  let fromDocs = [];
  if (localIds.length > 0) {
    const docs = await Promise.all(localIds.map((id) => fsGetDoc("locais", id)));
    fromDocs = docs.filter(Boolean);
  }

  return mergeLocaisRecords([], [...fromQuery, ...fromDocs].map((d) => normalizeLocalRecord({ ...d, id: d._id || d.id })));
}
