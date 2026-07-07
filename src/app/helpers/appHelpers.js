export const EMPTY_SUGESTOES = { descricoes: [], especies: [], marcas: [], fornecedores: [] };

export function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

export function buildManualPatrimonio(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return { id: `MAN_${Date.now()}`, patrimonioLabel: null, tomboRef: null };

  const upper = raw.toUpperCase();
  if (upper === "S/T" || upper === "ST" || upper === "SEM TOMBAMENTO") {
    return { id: `ST_${Date.now()}`, patrimonioLabel: "S/T", tomboRef: null };
  }

  const rand = Math.random().toString(36).slice(2, 6);
  return {
    id: `MAN_${Date.now()}_${rand}`,
    patrimonioLabel: raw,
    tomboRef: raw,
  };
}

export function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}

export function getDisplayEspecie(item, foundEntry) {
  return foundEntry?.especieEdit || item.especie || "—";
}

export function revokeBlobUrls(arr) {
  for (const s of arr || []) {
    const v = String(s || "");
    if (v.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(v);
      } catch {}
    }
  }
}

export function revokeRemovedBlobs(oldArr, newArr) {
  const keep = new Set((newArr || []).map((s) => String(s || "")));
  for (const s of oldArr || []) {
    const v = String(s || "");
    if (v.startsWith("blob:") && !keep.has(v)) {
      try {
        URL.revokeObjectURL(v);
      } catch {}
    }
  }
}
