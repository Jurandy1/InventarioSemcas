import { isItemInventariado } from "./patrimonioId.js";

export function isSemTomboItem(item, foundEntry) {
  if (foundEntry?.semTombo || foundEntry?.identificadoPorFoto) return true;
  if (item?.semTombo) return true;
  const label = String(item?.patrimonioLabel || "").trim().toUpperCase();
  if (label === "S/T" || label === "ST" || label === "SEM TOMBAMENTO") {
    return !!(foundEntry?.identificadoPorFoto || item?.identificadoPorFoto);
  }
  return false;
}

/** Item aguardando identificação na aba Ajuste (foto + descrição, ainda sem tombo real). */
export function isAjustePendente(item, foundEntry) {
  if (!foundEntry) return false;
  const id = String(item?.id || foundEntry.patrimonioId || foundEntry._id || "");
  if (foundEntry.vinculadoDeSemTombo && !id.startsWith("ST_")) return false;
  if (String(id).startsWith("ST_") || String(id).startsWith("MAN_")) return true;
  if (foundEntry.semTombo || foundEntry.identificadoPorFoto) return true;
  if (item?.isManual || foundEntry.isManual) return true;
  return isSemTomboItem(item, foundEntry);
}

/** Tombos da planilha ainda não inventariados (candidatos para receber foto). */
export function isTomboPendente(item, foundSet) {
  const id = String(item?.id || "");
  if (!id || id.startsWith("ST_") || id.startsWith("MAN_")) return false;
  if (!foundSet) return true;
  return !isItemInventariado(id, foundSet);
}

export const SEM_TOMBO_BADGE = { bg: "#fef3c7", tx: "#92400e", label: "Sem tombo" };
export const FOTO_MANUAL_BADGE = "Sem tombo";

export function showFotoManualBadge(item, foundEntry) {
  if (foundEntry?.vinculadoDeSemTombo || foundEntry?.alocadoManualmente) return FOTO_MANUAL_BADGE;
  if (isSemTomboItem(item, foundEntry)) return FOTO_MANUAL_BADGE;
  return "";
}
