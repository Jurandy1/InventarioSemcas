export function isSemTomboItem(item, foundEntry) {
  if (foundEntry?.semTombo || foundEntry?.identificadoPorFoto) return true;
  if (item?.semTombo) return true;
  const label = String(item?.patrimonioLabel || "").trim().toUpperCase();
  if (label === "S/T" || label === "ST" || label === "SEM TOMBAMENTO") {
    return !!(foundEntry?.identificadoPorFoto || item?.identificadoPorFoto);
  }
  return false;
}

export const SEM_TOMBO_BADGE = { bg: "#fef3c7", tx: "#92400e", label: "Sem tombo" };
export const FOTO_MANUAL_BADGE = "Sem tombo";

export function showFotoManualBadge(item, foundEntry) {
  if (foundEntry?.vinculadoDeSemTombo || foundEntry?.alocadoManualmente) return FOTO_MANUAL_BADGE;
  if (isSemTomboItem(item, foundEntry)) return FOTO_MANUAL_BADGE;
  return "";
}
