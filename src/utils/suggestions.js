import sugestoesDoacao from "../data/sugestoesDoacao.json";

function stripDiacritics(s) {
  const str = String(s);
  if (typeof str.normalize === "function") {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return str
    .replace(/[ÁÀÂÃÄ]/g, "A")
    .replace(/[áàâãä]/g, "a")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[éèêë]/g, "e")
    .replace(/[ÍÌÎÏ]/g, "I")
    .replace(/[íìîï]/g, "i")
    .replace(/[ÓÒÔÕÖ]/g, "O")
    .replace(/[óòôõö]/g, "o")
    .replace(/[ÚÙÛÜ]/g, "U")
    .replace(/[úùûü]/g, "u")
    .replace(/[Ç]/g, "C")
    .replace(/[ç]/g, "c");
}

function safeLocaleCompare(a, b) {
  try {
    return String(a).localeCompare(String(b), "pt-BR");
  } catch {
    return String(a).localeCompare(String(b));
  }
}

function uniqueSorted(values, limit = 1200) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (!v) continue;
    const raw = String(v).trim();
    if (!raw) continue;
    const key = stripDiacritics(raw).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= limit) break;
  }
  out.sort(safeLocaleCompare);
  return out;
}

export function gerarSugestoesDescricao(todosItens) {
  const extras = sugestoesDoacao.map(s => s.descricao);
  return uniqueSorted([...extras, ...(todosItens || []).map((i) => i?.descricao)]);
}

export function gerarSugestoesEspecie(todosItens) {
  return uniqueSorted((todosItens || []).map((i) => i?.especie));
}

export function gerarSugestoesMarca(todosItens) {
  return uniqueSorted((todosItens || []).map((i) => i?.marca));
}

export function gerarSugestoesFornecedor(todosItens) {
  const extras = sugestoesDoacao.map(s => s.origem);
  return uniqueSorted([...extras, ...(todosItens || []).map((i) => i?.fornecedor)]);
}

export function gerarTodasSugestoes(todosItens) {
  return {
    descricoes: gerarSugestoesDescricao(todosItens),
    especies: gerarSugestoesEspecie(todosItens),
    marcas: gerarSugestoesMarca(todosItens),
    fornecedores: gerarSugestoesFornecedor(todosItens),
  };
}
