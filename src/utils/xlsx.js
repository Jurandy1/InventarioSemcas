import * as XLSX from "xlsx";

export function parseXLSXFile(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const units = [];
  let cur = null;
  let hdrs = null;
  const pv = (s) => {
    if (!s) return 0;
    const c = String(s).split(" ")[0].replace(/\./g, "").replace(",", ".");
    return parseFloat(c) || 0;
  };

  for (const row of raw) {
    const f = String(row[0] || "").trim();
    if (/^\d{1,3}(\.\d+)?\s*-\s*.+/.test(f) && !f.startsWith("Total")) {
      if (cur?.itens.length) units.push(cur);
      cur = { id: `un_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, nome: f, itens: [] };
      hdrs = null;
      continue;
    }
    if (f === "Patrimônio" && cur) {
      hdrs = row.map((h) => String(h).trim());
      continue;
    }
    if (f.startsWith("Total")) continue;
    if (hdrs && cur && /^\d{5,}$/.test(f.replace(/\s/g, ""))) {
      const g = (n) => {
        const i = hdrs.indexOf(n);
        return i >= 0 ? String(row[i] || "").trim() : "";
      };
      cur.itens.push({
        id: f.replace(/\s/g, ""),
        data: g("Data"),
        especie: g("Espécie"),
        descricao: g("Descrição"),
        marca: g("Marca"),
        fornecedor: g("Fornecedor"),
        empenho: g("Empenho"),
        nf: g("N.F."),
        dataNF: g("Data N.F."),
        valor: pv(g("Valor NF/Reavaliado")),
        valorAtual: pv(g("Valor Atual")),
      });
    }
  }
  if (cur?.itens.length) units.push(cur);
  return units;
}

