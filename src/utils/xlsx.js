import { idbGet, idbSet } from "./db.js";

const XLSX_PATH = `${import.meta.env.BASE_URL}patrimonio_por_unidade.xlsx`;
const CACHE_KEY = "unidades_v5";
const TTL = 24 * 60 * 60 * 1000;

export async function loadUnidades(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = await idbGet(CACHE_KEY);
      if (
        cached &&
        Array.isArray(cached.data) &&
        cached.data.length > 0 &&
        Date.now() - cached.ts < TTL
      ) {
        return cached.data;
      }
    } catch {}
  }

  const res = await fetch(XLSX_PATH);
  if (!res.ok) throw new Error("Não foi possível carregar o arquivo de patrimônio");
  const buf = await res.arrayBuffer();
  const XLSX = await import("xlsx/xlsx.mjs");
  const wb = XLSX.read(buf);
  const data = parseXLSX(wb, XLSX);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("O arquivo de patrimônio foi lido, mas não gerou unidades.");
  }
  await idbSet(CACHE_KEY, { data, ts: Date.now() });
  return data;
}

function parseVal(s) {
  const match = String(s || "").trim().match(/^[\d.,]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/\./g, "").replace(",", ".")) || 0;
}

function normalizaTipo(raw) {
  const v = String(raw || "").toUpperCase().trim();
  if (v === "INCORPORADO") return "Incorporado";
  if (v === "DOAÇÃO" || v === "DOACAO") return "Doação";
  return "Próprio";
}

function parseValPair(valorRaw, valorAtualRaw) {
  const nums = String(valorRaw || "").match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
  const valor = nums.length > 0 ? parseFloat(nums[0].replace(/\./g, "").replace(",", ".")) : parseVal(valorRaw);

  if (valorAtualRaw && String(valorAtualRaw).trim() && String(valorAtualRaw).trim() !== "/") {
    return [valor, parseVal(valorAtualRaw)];
  }

  if (nums.length >= 2) {
    return [valor, parseFloat(nums[1].replace(/\./g, "").replace(",", "."))];
  }

  return [valor, 0];
}

export function parseXLSX(wb, XLSX) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const units = [];
  let cur = null;
  let hdrs = null;

  for (const row of raw) {
    const f = String(row[0] || "").trim();

    if (/^\d{1,3}(\.\d+)?\s*-\s*.+/.test(f) && !f.startsWith("Total")) {
      if (cur?.itens.length) units.push(cur);
      const m = f.match(/^([\d.]+)\s*-\s*(.+)$/);
      cur = { id: `u_${(m?.[1] || "").replace(/\./g, "_")}`, codigo: m?.[1] || "", nome: f, itens: [] };
      hdrs = null;
    } else if (f === "Patrimônio" && cur) {
      hdrs = row.map((h) => String(h).trim());
    } else if (!f.startsWith("Total") && hdrs && cur) {
      const patDigits = String(row[0] || "").trim().replace(/\D/g, "");
      if (!/^\d{5,9}$/.test(patDigits)) continue;
      const patId = patDigits.padStart(9, "0");
      const g = (n) => {
        const i = hdrs.indexOf(n);
        return i >= 0 ? String(row[i] || "").trim() : "";
      };

      const nf = g("N.F.").replace(/^[/\s]+$/, "").trim();
      const [valor, valorAtual] = parseValPair(g("Valor NF/Reavaliado"), g("Valor Atual"));
      const descricaoRaw = g("Descrição");
      const especieRaw = g("Espécie");

      cur.itens.push({
        id: patId,
        data: g("Data"),
        especie: especieRaw,
        descricao: descricaoRaw,
        marca: g("Marca"),
        fornecedor: g("Fornecedor"),
        empenho: g("Empenho"),
        nf,
        dataNF: g("Data N.F."),
        tipoEntrada: normalizaTipo(g("Tipo de Entrada")),
        valor,
        valorAtual,
      });
    }
  }
  if (cur?.itens.length) units.push(cur);
  return units;
}
