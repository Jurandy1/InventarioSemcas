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

/**
 * Dicionário espécie → palavras-chave para reconhecimento automático a partir
 * da descrição digitada. Ordem importa: termos mais específicos primeiro
 * (ex: "mesa de som" antes de "mesa"). Comparação sem acentos, minúscula.
 */
const ESPECIE_KEYWORDS = [
  ["TABLET", ["tablet", "ipad"]],
  ["CELULAR", ["celular", "smartphone", "iphone", "telefone movel"]],
  ["NOTEBOOK", ["notebook", "laptop", "macbook", "ultrabook"]],
  ["MONITOR", ["monitor"]],
  ["COMPUTADOR", ["computador", "desktop", "cpu", "all in one", "microcomputador"]],
  ["IMPRESSORA", ["impressora", "multifuncional"]],
  ["PROJETOR", ["projetor", "datashow", "data show"]],
  ["NOBREAK", ["nobreak", "no-break", "no break"]],
  ["ESTABILIZADOR", ["estabilizador"]],
  ["ROTEADOR", ["roteador", "modem", "access point", "switch de rede"]],
  ["SCANNER", ["scanner"]],
  ["CAIXA DE SOM", ["caixa de som", "caixa amplificada", "caixa acustica"]],
  ["MESA DE SOM", ["mesa de som", "mesa audio"]],
  ["MICROFONE", ["microfone"]],
  ["CÂMERA", ["camera", "filmadora", "webcam"]],
  ["TELEVISOR", ["televisor", "televisao", "smart tv", "tv "]],
  ["TELEFONE", ["telefone", "aparelho telefonico", "interfone"]],
  ["AR CONDICIONADO", ["ar condicionado", "ar-condicionado", "split", "climatizador"]],
  ["VENTILADOR", ["ventilador"]],
  ["GELADEIRA", ["geladeira", "refrigerador", "frigobar"]],
  ["FREEZER", ["freezer"]],
  ["FOGÃO", ["fogao"]],
  ["MICRO-ONDAS", ["micro-ondas", "microondas", "micro ondas", "forno eletrico"]],
  ["BEBEDOURO", ["bebedouro", "purificador de agua", "purificador"]],
  ["LIQUIDIFICADOR", ["liquidificador"]],
  ["BATEDEIRA", ["batedeira"]],
  ["MÁQUINA DE LAVAR", ["maquina de lavar", "lavadora de roupas", "lava e seca"]],
  ["CADEIRA", ["cadeira"]],
  ["LONGARINA", ["longarina"]],
  ["POLTRONA", ["poltrona"]],
  ["SOFÁ", ["sofa"]],
  ["BANQUETA", ["banqueta", "banquinho"]],
  ["MESA", ["mesa", "escrivaninha", "biro", "birô"]],
  ["ARMÁRIO", ["armario", "guarda-louca"]],
  ["ROUPEIRO", ["roupeiro", "guarda-roupa", "guarda roupa"]],
  ["ESTANTE", ["estante", "prateleira"]],
  ["ARQUIVO", ["arquivo de aco", "arquivo aco", "arquivo deslizante", "gaveteiro"]],
  ["BALCÃO", ["balcao"]],
  ["BELICHE", ["beliche"]],
  ["CAMA", ["cama"]],
  ["BERÇO", ["berco"]],
  ["COLCHÃO", ["colchao", "colchonete"]],
  ["QUADRO", ["quadro branco", "quadro de aviso", "quadro magnetico", "lousa", "flip chart", "flipchart"]],
  ["BALANÇA", ["balanca"]],
  ["EXTINTOR", ["extintor"]],
  ["ESCADA", ["escada"]],
  ["CARRINHO", ["carrinho"]],
  ["MACA", ["maca "]],
];

export function inferEspecieFromDesc(desc, especies = []) {
  const raw = String(desc || "").trim();
  if (!raw) return "";
  const words = raw.split(/\s+/).filter(Boolean);
  const q = ` ${stripDiacritics(raw).toLowerCase()} `;

  // 1) Espécie já usada na planilha aparecendo como palavra inteira na
  //    descrição (mantém a grafia oficial da base). Prefere a mais longa.
  let bestPlanilha = "";
  for (const sp of especies || []) {
    const s = stripDiacritics(String(sp)).toLowerCase().trim();
    if (!s || s.length < 3) continue;
    if (q.includes(` ${s} `) && s.length > stripDiacritics(bestPlanilha).length) {
      bestPlanilha = String(sp).trim();
    }
  }
  if (bestPlanilha) return bestPlanilha;

  // 2) Dicionário de palavras-chave (reconhece "Tablet Samsung A9" → TABLET,
  //    "Cadeira giratória preta" → CADEIRA etc).
  for (const [especie, keywords] of ESPECIE_KEYWORDS) {
    for (const kw of keywords) {
      const k = kw.endsWith(" ") ? ` ${kw}` : ` ${kw}`;
      if (q.includes(k)) return especie;
    }
  }

  // 3) Fallback: primeira palavra da descrição.
  return String(words[0] || "").toUpperCase().slice(0, 40);
}

/** Itens que possuem IMEI ou nº de série relevante (tablets, celulares etc). */
export function supportsImei(text) {
  const q = ` ${stripDiacritics(String(text || "")).toLowerCase()} `;
  const terms = ["tablet", "ipad", "celular", "smartphone", "iphone", "notebook", "laptop", "macbook", "chip", "modem", "roteador"];
  return terms.some((t) => q.includes(` ${t}`));
}

export function maskTipoEntrada(tipo) {
  return tipo === "Permuta" ? "Próprio" : tipo || "Próprio";
}

export function sortByDataNF(a, b) {
  return parseBrDate(b?.dataNF) - parseBrDate(a?.dataNF);
}

export function getItemNfMs(item) {
  return parseBrDate(item?.dataNF).getTime();
}

/** Ordena locais pela NF mais recente entre os itens alocados em cada um. */
export function sortLocaisByNewestNf(locais = [], foundMap = {}, itemById = new Map(), activeUnitIds = []) {
  const unitSet = new Set(activeUnitIds || []);
  const newestByLocal = new Map();
  for (const id in foundMap || {}) {
    const f = foundMap[id];
    if (!f?.localId) continue;
    if (unitSet.size && f.unidadeId && !unitSet.has(f.unidadeId)) continue;
    const it = itemById.get(id) || itemById.get(f.patrimonioId || "");
    const ms = getItemNfMs(it);
    const lid = f.localId;
    newestByLocal.set(lid, Math.max(newestByLocal.get(lid) || 0, ms));
  }
  return [...(locais || [])].sort((a, b) => {
    const ma = newestByLocal.get(a.id || a._id) || 0;
    const mb = newestByLocal.get(b.id || b._id) || 0;
    if (mb !== ma) return mb - ma;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

export function buildDoacaoOrigemExtras(getField, prefix = "man") {
  const origem = getField(`${prefix}Origem`) || getField("detOrigem") || "";
  if (origem !== "Doação") return {};
  const mode = getField(`${prefix}DoacaoModo`) || "uf";
  if (mode === "texto") {
    const texto = String(getField(`${prefix}DoacaoTexto`) || "").trim();
    return texto ? { doacaoOrigem: texto, doacaoOrigemTipo: "texto" } : {};
  }
  const uf = String(getField(`${prefix}DoacaoUf`) || "MA").trim().toUpperCase();
  return uf ? { doacaoOrigem: uf, doacaoOrigemTipo: "uf" } : {};
}
