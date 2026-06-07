function stripDiacritics(s) {
  const str = String(s);
  if (typeof str.normalize === "function") {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return str;
}

export const NOVO_FROM_DATE = new Date(2023, 6, 1);

export function parseBrDate(s) {
  if (!s) return new Date(0);
  const parts = String(s).split("/");
  if (parts.length !== 3) return new Date(0);
  const [d, m, y] = parts;
  const year = +y;
  if (!year || year < 1900) return new Date(0);
  return new Date(year, +m - 1, +d);
}

export function defaultEstadoForItem(item) {
  const nf = parseBrDate(item?.dataNF);
  const tomb = parseBrDate(item?.data);
  if (nf >= NOVO_FROM_DATE || tomb >= NOVO_FROM_DATE) return "Novo";
  return "Bom";
}

export function inferEspecieFromDesc(desc, especies = []) {
  const raw = String(desc || "").trim();
  if (!raw) return "";
  const words = raw.split(/\s+/).filter(Boolean);
  const q = stripDiacritics(raw).toLowerCase();

  for (const sp of especies || []) {
    const s = stripDiacritics(String(sp)).toLowerCase().trim();
    if (!s) continue;
    if (q.includes(s) || s.includes(stripDiacritics(words[0] || "").toLowerCase())) {
      return String(sp).trim();
    }
  }

  return String(words[0] || "").toUpperCase().slice(0, 40);
}

export function maskTipoEntrada(tipo) {
  return tipo === "Permuta" ? "Próprio" : tipo || "Próprio";
}

export function sortByDataNF(a, b) {
  return parseBrDate(b?.dataNF) - parseBrDate(a?.dataNF);
}
