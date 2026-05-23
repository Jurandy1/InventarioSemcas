import * as XLSX from "xlsx";
import { idbGet, idbSet } from "./db.js";

const XLSX_PATH = `${import.meta.env.BASE_URL}patrimonio_por_unidade.xlsx`;
// PATCH v2.2 — bumped de "unidades_v2" para "unidades_v3" para forçar
// recarga automática após troca da planilha (68 itens corrigidos + fix valorAtual)
const CACHE_KEY = "unidades_v3";
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

// parseVal — extrai PRIMEIRO número de uma string com formato brasileiro.
// Também funciona para valores numéricos puros retornados pelo xlsx.js.
function parseVal(s) {
  const match = String(s || "")
    .trim()
    .match(/^[\d.,]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/\./g, "").replace(",", ".")) || 0;
}

// parseValPair — PATCH v2.2: lida com col13 que às vezes contém dois valores
// colados ("5.270,00 3.451,85"). Retorna [valor, valorAtual].
// Se col14 (valorAtual) estiver preenchida, usa col14 normalmente.
function parseValPair(valorRaw, valorAtualRaw) {
  const nums = String(valorRaw || "").match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
  const valor = nums.length > 0 ? parseFloat(nums[0].replace(/\./g, "").replace(",", ".")) : parseVal(valorRaw);

  if (valorAtualRaw && String(valorAtualRaw).trim() && String(valorAtualRaw).trim() !== "/") {
    return [valor, parseVal(valorAtualRaw)];
  }
  // col14 vazia: tenta extrair o segundo número de col13
  if (nums.length >= 2) {
    return [valor, parseFloat(nums[1].replace(/\./g, "").replace(",", "."))];
  }
  return [valor, 0];
}

function normalizaTipo(raw) {
  const v = String(raw || "").toUpperCase().trim();
  if (v === "INCORPORADO") return "Incorporado";
  if (v === "DOAÇÃO" || v === "DOACAO") return "Doação";
  return "Próprio";
}

export function parseXLSX(wb) {
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
      cur = {
        id: `u_${(m?.[1] || "").replace(/\./g, "_")}`,
        codigo: m?.[1] || "",
        nome: f,
        itens: [],
      };
      hdrs = null;
    } else if (f === "Patrimônio" && cur) {
      hdrs = row.map((h) => String(h).trim());
    } else if (!f.startsWith("Total") && hdrs && cur && /^\d{5,}$/.test(f)) {
      const g = (n) => {
        const i = hdrs.indexOf(n);
        return i >= 0 ? String(row[i] || "").trim() : "";
      };

      const nf = g("N.F.").replace(/^[/\s]+$/, "").trim();

      // PATCH v2.2 — usa parseValPair para recuperar valorAtual de itens
      // onde col13 contém dois valores colados e col14 está vazia (738 itens)
      const [valor, valorAtual] = parseValPair(
        g("Valor NF/Reavaliado"),
        g("Valor Atual")
      );

      // PATCH v2.2 — usa espécie como fallback de descrição quando ambas
      // estão presentes; mantém descrição original se existir
      const descricaoRaw = g("Descrição");
      const especieRaw = g("Espécie");

      cur.itens.push({
        id: f,
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
