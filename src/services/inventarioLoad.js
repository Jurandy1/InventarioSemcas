import { fsGetAll, fsGetDoc } from "./firebase.js";
import { normalizePatrimonioId } from "../utils/patrimonioId.js";

const DOC_BATCH = 25;

export function normalizeFoundRecord(entry) {
  if (!entry) return entry;
  const pid = normalizePatrimonioId(entry.patrimonioId || entry._id);
  return pid ? { ...entry, patrimonioId: pid, _id: pid } : entry;
}

async function fetchInventarioByDocIds(patrimonioIds = []) {
  const unique = [...new Set(patrimonioIds.map((id) => normalizePatrimonioId(id)).filter(Boolean))];
  if (!unique.length) return [];

  const out = [];
  for (let i = 0; i < unique.length; i += DOC_BATCH) {
    const chunk = unique.slice(i, i + DOC_BATCH);
    const docs = await Promise.all(chunk.map((id) => fsGetDoc("inventario", id)));
    for (const d of docs) {
      if (d) out.push(normalizeFoundRecord(d));
    }
  }
  return out;
}

async function fetchInventarioViaQuery(unitIds = []) {
  const ids = Array.isArray(unitIds) ? unitIds.filter(Boolean) : [];
  if (!ids.length) return [];

  const fetchByUnit = async (uid) => {
    let rows = await fsGetAll("inventario", {
      where: [{ field: "unidadeId", op: "EQUAL", value: uid }],
    });
    if (rows.length === 0) {
      rows = await fsGetAll("inventario", {
        where: [{ field: "unidadeId", op: "EQUAL", value: uid }],
        orderBy: ["__name__"],
      });
    }
    return rows;
  };

  const seen = new Set();
  const merged = [];

  const chunks = await Promise.all(ids.map(fetchByUnit));
  for (const chunk of chunks) {
    for (const d of chunk) {
      const pid = normalizePatrimonioId(d.patrimonioId || d._id);
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      merged.push(normalizeFoundRecord(d));
    }
  }

  return merged;
}

function mergeInventarioDocs(...groups) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const d of group || []) {
      const pid = normalizePatrimonioId(d.patrimonioId || d._id);
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      merged.push(normalizeFoundRecord(d));
    }
  }
  return merged;
}

/** Carrega inventário — prioriza GET por tombo (funciona mesmo com list/query bloqueados). */
export async function fetchInventarioForUnits(unitIds = [], options = {}) {
  const patrimonioIds = options.patrimonioIds || [];
  const unitIdList = Array.isArray(unitIds) ? unitIds.filter(Boolean) : [];

  let fromDocs = [];
  if (patrimonioIds.length > 0) {
    fromDocs = await fetchInventarioByDocIds(patrimonioIds);
  }

  let fromQuery = [];
  if (unitIdList.length > 0) {
    try {
      fromQuery = await fetchInventarioViaQuery(unitIdList);
    } catch (e) {
      console.warn("Consulta inventario falhou:", e?.message || e);
    }
  }

  return mergeInventarioDocs(fromDocs, fromQuery);
}
