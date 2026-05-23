import * as XLSX from "xlsx";
import { idbGet, idbSet } from "./db.js";

const XLSX_PATH = `${import.meta.env.BASE_URL}patrimonio_por_unidade.xlsx`;
const CACHE_KEY = "unidades_v1";
const TTL = 24 * 60 * 60 * 1000;

export async function loadUnidades(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = await idbGet(CACHE_KEY);
      if (cached && Date.now() - cached.ts < TTL) return cached.data;
    } catch {}
  }

  const res = await fetch(XLSX_PATH);
  if (!res.ok) throw new Error("Não foi possível carregar o arquivo de patrimônio");
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf);
  const data = parseXLSX(wb);
  await idbSet(CACHE_KEY, { data, ts: Date.now() });
  return data;
}

export function parseXLSX(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const units = [];
  let cur = null;
  let hdrs = null;
  const pv = (s) => parseFloat(String(s || "").split(" ")[0].replace(/\./g, "").replace(",", ".")) || 0;

  for (const row of raw) {
    const f = String(row[0] || "").trim();

    if (/^\d{1,3}(\.\d+)?\s*-\s*.+/.test(f) && !f.startsWith("Total")) {
      if (cur?.itens.length) units.push(cur);
      const m = f.match(/^([\d.]+)\s*-\s*(.+)$/);
      cur = { id: `u_${(m?.[1] || "").replace(/\./g, "_")}`, codigo: m?.[1] || "", nome: f, itens: [] };
      hdrs = null;
    } else if (f === "Patrimônio" && cur) {
      hdrs = row.map((h) => String(h).trim());
    } else if (!f.startsWith("Total") && hdrs && cur && /^\d{5,}$/.test(f)) {
      const g = (n) => {
        const i = hdrs.indexOf(n);
        return i >= 0 ? String(row[i] || "").trim() : "";
      };
      cur.itens.push({
        id: f,
        data: g("Data"),
        especie: g("Espécie"),
        descricao: g("Descrição"),
        marca: g("Marca"),
        fornecedor: g("Fornecedor"),
        empenho: g("Empenho"),
        nf: g("N.F."),
        dataNF: g("Data N.F."),
        tipoEntrada: g("Tipo de Entrada"),
        valor: pv(g("Valor NF/Reavaliado")),
        valorAtual: pv(g("Valor Atual")),
      });
    }
  }
  if (cur?.itens.length) units.push(cur);
  return units;
}

