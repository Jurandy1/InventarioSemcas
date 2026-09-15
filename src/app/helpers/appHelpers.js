export const EMPTY_SUGESTOES = { descricoes: [], especies: [], marcas: [], fornecedores: [] };

/** UUID estável por item (com ou sem tombo) — para updates futuros e exports. */
export function newInternalId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return `iid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Lê a ID interna do item/inventário (campo próprio ou extras). */
export function getItemIdInterno(item, foundEntry) {
  return (
    foundEntry?.idInterno ||
    item?.idInterno ||
    foundEntry?.id_interno ||
    item?.id_interno ||
    foundEntry?.extras?.idInterno ||
    item?.extras?.idInterno ||
    foundEntry?.extras?.id_interno ||
    item?.extras?.id_interno ||
    ""
  );
}

/** Como o item entrou no inventário — importante para planilhas/atualizações. */
export const TIPO_REGISTRO = {
  ENCONTRADO: "Item encontrado",
  MANUAL: "Manual",
  VARIOS: "Vários iguais",
};

/**
 * Classifica o registro: Item encontrado (tombo da planilha), Manual ou Vários iguais.
 * Usa campo gravado quando existir; senão infere por flags/padrão de ID.
 */
export function getTipoRegistroItem(item, foundEntry) {
  const stored =
    foundEntry?.tipoRegistro ||
    item?.tipoRegistro ||
    foundEntry?.extras?.tipoRegistro ||
    item?.extras?.tipoRegistro ||
    "";
  if (stored === TIPO_REGISTRO.ENCONTRADO || stored === TIPO_REGISTRO.MANUAL || stored === TIPO_REGISTRO.VARIOS) {
    return stored;
  }

  const id = String(item?.id || foundEntry?.patrimonioId || foundEntry?._id || "");
  const manual = Boolean(
    foundEntry?.isManual || item?.isManual || /^(MAN_|ST_)/i.test(id)
  );
  if (!manual) return TIPO_REGISTRO.ENCONTRADO;

  // qty>1 / multi: MAN_ts_rand_n  ou  ST_ts_rand_n  (índice no final)
  if (/^(MAN|ST)_\d+_[a-z0-9]+_\d+/i.test(id)) return TIPO_REGISTRO.VARIOS;
  return TIPO_REGISTRO.MANUAL;
}

export function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

export function buildManualPatrimonio(rawValue) {
  const raw = String(rawValue || "").trim();
  const idInterno = newInternalId();
  if (!raw) return { id: `MAN_${Date.now()}`, patrimonioLabel: null, tomboRef: null, idInterno };

  const upper = raw.toUpperCase();
  if (upper === "S/T" || upper === "ST" || upper === "SEM TOMBAMENTO") {
    return { id: `ST_${Date.now()}`, patrimonioLabel: "S/T", tomboRef: null, idInterno };
  }

  const rand = Math.random().toString(36).slice(2, 6);
  return {
    id: `MAN_${Date.now()}_${rand}`,
    patrimonioLabel: raw,
    tomboRef: raw,
    idInterno,
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
