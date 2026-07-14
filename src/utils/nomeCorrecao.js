import { normalizeMatchText, textSimilarity } from "./ajusteMatch.js";
import { getFoundEntry, isItemInventariado } from "./patrimonioId.js";

export function getItemLabel(item, foundMap) {
  const f = getFoundEntry(item?.id, foundMap);
  return String(f?.descricaoEdit || item?.descricao || item?.especie || "").trim();
}

export function getItemMarca(item, foundMap) {
  const f = getFoundEntry(item?.id, foundMap);
  const marca = String(f?.marca || item?.marca || "").trim();
  return /^(nao informado|não informado|n\/i|ni|-+)$/i.test(marca) ? "" : marca;
}

/** Fotos do item — busca no inventário com id normalizado (ex.: 14019988 → 014019988). */
export function getItemFotos(itemId, foundMap) {
  const f = getFoundEntry(itemId, foundMap);
  return Array.isArray(f?.fotoUrls) ? f.fotoUrls : [];
}

export function isManualItem(item) {
  const id = String(item?.id || "");
  return Boolean(item?.isManual) || id.startsWith("MAN_") || id.startsWith("ST_");
}

export function getItemEspecie(item, foundMap) {
  const f = getFoundEntry(item?.id, foundMap);
  const esp = String(f?.especieEdit || item?.especie || "").trim();
  return esp || "Sem espécie";
}

/** Agrupa itens por espécie (ordenado por quantidade, depois nome). */
export function groupItemsByEspecie(items, foundMap) {
  const map = new Map();
  for (const item of items || []) {
    const esp = getItemEspecie(item, foundMap);
    if (!map.has(esp)) map.set(esp, []);
    map.get(esp).push(item);
  }
  return [...map.entries()]
    .map(([especie, members]) => ({ especie, members, count: members.length }))
    .sort((a, b) => {
      if (a.especie === "Sem espécie") return 1;
      if (b.especie === "Sem espécie") return -1;
      if (b.count !== a.count) return b.count - a.count;
      return a.especie.localeCompare(b.especie, "pt-BR");
    });
}

// ─── Atributos: cores, materiais, medidas e "com/sem" ────────────────────────

const CORES = new Set([
  "preto", "preta", "branco", "branca", "azul", "vermelho", "vermelha", "verde",
  "amarelo", "amarela", "cinza", "chumbo", "grafite", "marrom", "bege", "rosa",
  "roxo", "roxa", "lilas", "laranja", "vinho", "creme", "dourado", "dourada",
  "prata", "prateado", "prateada", "cromado", "cromada", "turquesa", "salmao", "fume",
]);

const MATERIAIS = new Set([
  "madeira", "aco", "ferro", "plastico", "plastica", "mdf", "mdp", "inox",
  "aluminio", "courino", "couro", "tecido", "granito", "formica", "acrilico",
  "metal", "metalico", "metalica", "polipropileno", "compensado", "vime",
  "fibra", "napa", "nylon", "lona", "marmore",
]);

// Qualificadores que mudam o TIPO do item: se um nome tem "infantil" e o outro
// não tem, são itens diferentes (cadeira infantil ≠ cadeira comum).
const QUALIFICADORES = new Set([
  "infantil", "juvenil", "adulto", "adulta", "escolar", "universitario", "universitaria",
  "gamer", "hospitalar", "industrial", "portatil", "digital", "analogico", "analogica",
  "eletrico", "eletrica", "giratorio", "giratoria",
]);

// Canonicaliza variações de gênero/plural (preta → preto, plástica → plástico…)
const CANON = {
  preta: "preto", branca: "branco", vermelha: "vermelho", amarela: "amarelo",
  roxa: "roxo", dourada: "dourado", prateada: "prateado", cromada: "cromado",
  plastica: "plastico", metalica: "metal", metalico: "metal",
  adulta: "adulto", universitaria: "universitario", analogica: "analogico",
  eletrica: "eletrico", giratoria: "giratorio",
};

function canonToken(t) {
  const semPlural = t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
  return CANON[semPlural] || CANON[t] || semPlural;
}

/** Expande abreviações comuns de inventário: s/b → sem braço, c/ → com, p/ → para. */
export function expandNomeAbreviacoes(text) {
  let t = ` ${String(text || "").toLowerCase()} `;
  t = t.replace(/\bs\/\s*/g, "sem ").replace(/\bc\/\s*/g, "com ").replace(/\bp\/\s*/g, "para ");
  t = t.replace(/\b(com|sem)\s+br?\b/g, "$1 braco");
  t = t.replace(/\b(com|sem)\s+enc\b/g, "$1 encosto");
  t = t.replace(/\b(com|sem)\s+rod(inha)?s?\b/g, "$1 rodinha");
  return t.replace(/\s+/g, " ").trim();
}

const UNIDADES_MEDIDA =
  /(\d+(?:[.,]\d+)?)\s*(portas?|gavetas?|lugares?|btus?|polegadas?|pol|litros?|cm|mm|mts?|m|kg|rodas?|prateleiras?|andares?|lampadas?|hp|v|w)\b/g;

/**
 * Extrai atributos discriminantes de um nome de item:
 * cores, materiais, flags com/sem (braço, encosto…), medidas (2 portas) e números.
 */
export function extractNomeAtributos(nome) {
  const norm = normalizeMatchText(expandNomeAbreviacoes(nome));
  const cores = new Set();
  const materiais = new Set();
  const qualificadores = new Set();
  const flags = new Map(); // palavra → true (com) / false (sem)
  const medidas = new Map(); // unidade → Set(valores)
  const numeros = new Set();

  const tokens = new Set();
  for (const tok of norm.split(" ")) {
    if (!tok) continue;
    const c = canonToken(tok);
    if (tok.length > 2) tokens.add(c);
    if (CORES.has(tok) || CORES.has(c)) cores.add(c);
    if (MATERIAIS.has(tok) || MATERIAIS.has(c)) materiais.add(c);
    if (QUALIFICADORES.has(tok) || QUALIFICADORES.has(c)) qualificadores.add(c);
  }

  let m;
  const flagRe = /(?:^|\s)(com|sem)\s+(?:\d+\s+)?([a-z]{2,})/g;
  while ((m = flagRe.exec(norm))) {
    const palavra = canonToken(m[2]);
    if (palavra === "com" || palavra === "sem" || palavra === "para") continue;
    flags.set(palavra, m[1] === "com");
  }

  UNIDADES_MEDIDA.lastIndex = 0;
  while ((m = UNIDADES_MEDIDA.exec(norm))) {
    const valor = String(parseFloat(m[1].replace(",", ".")));
    const unidade = canonToken(m[2]);
    if (!medidas.has(unidade)) medidas.set(unidade, new Set());
    medidas.get(unidade).add(valor);
  }

  for (const n of norm.match(/\d+(?:[.,]\d+)?/g) || []) {
    numeros.add(String(parseFloat(n.replace(",", "."))));
  }

  return { cores, materiais, qualificadores, flags, medidas, numeros, tokens };
}

// Palavra "quase igual" a um qualificador (tolera typo: giratórea ≈ giratorio)
function temTokenParecido(tokens, palavra) {
  if (!tokens) return false;
  if (tokens.has(palavra)) return true;
  for (const t of tokens) {
    if (Math.abs(t.length - palavra.length) <= 2 && levenshteinRatio(t, palavra) >= 0.75) return true;
  }
  return false;
}

function disjuntos(a, b) {
  for (const x of a) if (b.has(x)) return false;
  return true;
}

/**
 * Compara atributos de dois nomes.
 * conflicts: atributos EXPLÍCITOS e diferentes (cor azul × cor preta, c/braço × s/braço,
 * 2 portas × 3 portas) — itens assim NUNCA devem ser agrupados.
 * partial: atributo presente só de um lado (penalidade leve).
 */
export function compareNomeAtributos(A, B) {
  const conflicts = [];
  let partial = 0;

  if (A.cores.size && B.cores.size) {
    if (disjuntos(A.cores, B.cores)) conflicts.push("cor");
  } else if (A.cores.size || B.cores.size) partial++;

  if (A.materiais.size && B.materiais.size) {
    if (disjuntos(A.materiais, B.materiais)) conflicts.push("material");
  } else if (A.materiais.size || B.materiais.size) partial++;

  // Qualificador de tipo é ELIMINATÓRIO até quando presente só de um lado:
  // "cadeira infantil azul" nunca combina com "cadeira azul" (não é infantil).
  const quals = new Set([...(A.qualificadores || []), ...(B.qualificadores || [])]);
  for (const q of quals) {
    const emA = A.qualificadores?.has(q) || temTokenParecido(A.tokens, q);
    const emB = B.qualificadores?.has(q) || temTokenParecido(B.tokens, q);
    if (!emA || !emB) conflicts.push(`qualificador ${q}`);
  }

  for (const [palavra, comA] of A.flags) {
    if (B.flags.has(palavra)) {
      if (B.flags.get(palavra) !== comA) conflicts.push(`com/sem ${palavra}`);
    } else partial++;
  }
  for (const palavra of B.flags.keys()) {
    if (!A.flags.has(palavra)) partial++;
  }

  for (const [unidade, valoresA] of A.medidas) {
    const valoresB = B.medidas.get(unidade);
    if (valoresB && disjuntos(valoresA, valoresB)) conflicts.push(unidade);
  }

  if (A.numeros.size && B.numeros.size && disjuntos(A.numeros, B.numeros)) {
    conflicts.push("numeracao");
  }

  return { conflicts, partial };
}

/** Chips legíveis dos atributos detectados (para exibir na interface). */
export function describeNomeAtributos(nome) {
  const a = extractNomeAtributos(nome);
  const chips = [];
  for (const q of a.qualificadores) chips.push({ tipo: "qualificador", texto: q });
  for (const cor of a.cores) chips.push({ tipo: "cor", texto: cor });
  for (const mat of a.materiais) chips.push({ tipo: "material", texto: mat });
  for (const [palavra, com] of a.flags) chips.push({ tipo: "flag", texto: `${com ? "com" : "sem"} ${palavra}` });
  for (const [unidade, valores] of a.medidas) {
    for (const v of valores) chips.push({ tipo: "medida", texto: `${v} ${unidade}` });
  }
  return chips;
}

function levenshteinRatio(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - d[m][n] / Math.max(m, n);
}

/**
 * Similaridade entre nomes (typos, abreviações, palavras em comum),
 * com veto por atributos conflitantes: "cadeira plástica PRETA" nunca
 * combina com "cadeira plástica AZUL", nem "c/ braço" com "s/ braço".
 */
export function nomeSimilarity(a, b) {
  const ea = expandNomeAbreviacoes(a);
  const eb = expandNomeAbreviacoes(b);
  const na = normalizeMatchText(ea);
  const nb = normalizeMatchText(eb);
  if (!na || !nb) return 0;

  const cmp = compareNomeAtributos(extractNomeAtributos(a), extractNomeAtributos(b));
  if (cmp.conflicts.length) return 0;

  if (na === nb) return 1;
  const wordSim = textSimilarity(ea, eb);
  const levSim = levenshteinRatio(na, nb);
  const contain = na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na)) ? 0.78 : 0;
  let sim = Math.max(wordSim, levSim, contain);
  // Atributo presente só de um lado (ex.: um diz a cor, o outro não): penalidade leve
  if (cmp.partial) sim *= Math.pow(0.92, Math.min(cmp.partial, 3));
  return sim;
}

/**
 * Limpa um nome para exibição/padronização: expande abreviações mantendo o
 * restante do texto, tira espaços duplicados e aplica capitalização PT-BR.
 */
const PT_LOWER_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "com", "sem", "para", "a", "o", "as", "os", "na", "no", "nas", "nos",
]);

/**
 * Padronização completa de um nome de item.
 * Ex.: "Cadeira Plastica s/Braço" → "Cadeira de plástico sem braço"
 */
const ORTOGRAFIA = {
  plastico: "plástico",
  plastica: "plástico",
  aco: "aço",
  aluminio: "alumínio",
  braco: "braço",
  giratorio: "giratório",
  giratoria: "giratória",
  regulavel: "regulável",
  marmore: "mármore",
  analogico: "analógico",
  analogica: "analógico",
  eletrico: "elétrico",
  eletrica: "elétrico",
  portatil: "portátil",
  universitario: "universitário",
  universitaria: "universitário",
  salmao: "salmão",
};

const MATERIAIS_COM_DE = new Set([
  "plástico", "plastico", "madeira", "aço", "aco", "metal", "ferro", "alumínio", "aluminio",
  "mdf", "mdp", "inox", "couro", "tecido", "vidro", "granito", "mármore", "marmore", "acrilico",
  "acrilico", "formica", "compensado", "polipropileno", "courino", "vime", "fibra",
]);

function aplicarOrtografia(text) {
  return String(text || "")
    .split(" ")
    .map((w) => {
      if (!w) return "";
      const low = w.toLowerCase();
      return ORTOGRAFIA[low] || w;
    })
    .join(" ");
}

function inserirPreposicaoDe(text) {
  const words = String(text || "").split(" ").filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wLow = w.toLowerCase();
    const prevLow = out[out.length - 1]?.toLowerCase();
    if (
      i > 0 &&
      MATERIAIS_COM_DE.has(wLow) &&
      prevLow &&
      prevLow !== "de" &&
      prevLow !== "com" &&
      prevLow !== "sem" &&
      prevLow !== "para"
    ) {
      out.push("de");
    }
    out.push(w);
  }
  return out.join(" ");
}

function expandirAbreviacoesCompletas(nome) {
  let t = String(nome || "").trim().replace(/\s+/g, " ");
  t = t.replace(/\bs\/\s*p(?:orta)?\b/gi, "sem porta");
  t = t.replace(/\bc\/\s*p(?:orta)?\b/gi, "com porta");
  t = t.replace(/\bs\/\s*enc(?:osto)?\b/gi, "sem encosto");
  t = t.replace(/\bc\/\s*enc(?:osto)?\b/gi, "com encosto");
  t = t.replace(/\bs\/\s*b(?:r(?:aco|aço)?)?\b/gi, "sem braço");
  t = t.replace(/\bc\/\s*b(?:r(?:aco|aço)?)?\b/gi, "com braço");
  t = t.replace(/\bs\/\s*rod(?:inha|as)?\b/gi, "sem rodinha");
  t = t.replace(/\bc\/\s*rod(?:inha|as)?\b/gi, "com rodinha");
  t = t.replace(/\bs\/\s*gav(?:eta)?s?\b/gi, "sem gaveta");
  t = t.replace(/\bc\/\s*gav(?:eta)?s?\b/gi, "com gaveta");
  t = t.replace(/\bs\/\s*/gi, "sem ").replace(/\bc\/\s*/gi, "com ").replace(/\bp\/\s*/gi, "para ");
  t = t.replace(/\breg\.?\b/gi, "regulável");
  t = t.replace(/\bgir\.?\b/gi, "giratório");
  return t.replace(/\s+/g, " ").trim();
}

export function padronizarNome(nome) {
  let t = expandirAbreviacoesCompletas(nome);
  t = aplicarOrtografia(t);
  t = inserirPreposicaoDe(t);
  t = formatarNomePadrao(t);
  return t.trim();
}

/** Nome precisa de padronização de grafia? */
export function precisaPadronizacao(nome) {
  const original = String(nome || "").trim();
  if (!original) return false;
  const pad = padronizarNome(original);
  return normalizeMatchText(original) !== normalizeMatchText(pad);
}

export function limparNomeParaExibicao(nome) {
  return padronizarNome(nome);
}

/** Capitalização inteligente para descrições de patrimônio (preserva siglas curtas). */
export function formatarNomePadrao(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  return raw
    .split(" ")
    .map((word, idx) => {
      if (!word) return "";
      const low = word.toLowerCase();
      if (idx > 0 && PT_LOWER_WORDS.has(low)) return low;
      if (/^[A-Z0-9]{2,5}$/.test(word) && word === word.toUpperCase()) return word;
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(" ");
}

/**
 * Sugere o nome padrão de um grupo: escolhe o rótulo mais completo
 * (mais atributos descritos, mais palavras, com foto, grafia com acentos)
 * e o normaliza para exibição.
 */
export function sugerirNomePadrao(members, foundMap) {
  let best = null;
  let bestScore = -Infinity;
  for (const m of members || []) {
    const a = m.atributos || extractNomeAtributos(m.label);
    const nAtributos =
      a.cores.size + a.materiais.size + (a.qualificadores?.size || 0) + a.flags.size + a.medidas.size;
    const nPalavras = normalizeMatchText(expandNomeAbreviacoes(m.label)).split(" ").filter(Boolean).length;
    const temFoto = getItemFotos(m.id, foundMap).length > 0 ? 1 : 0;
    const temAcento = /[áéíóúâêôãõç]/i.test(m.label) ? 0.5 : 0;
    const semAbreviacao = /\b[csp]\//i.test(m.label) ? 0 : 0.5;
    const score = nAtributos * 3 + nPalavras + temFoto + temAcento + semAbreviacao;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return limparNomeParaExibicao(best?.label || "");
}

function pickReferenceMember(members, foundMap) {
  return members.reduce((best, m) => {
    const fotosBest = foundMap?.[best.id]?.fotoUrls?.length || 0;
    const fotosM = foundMap?.[m.id]?.fotoUrls?.length || 0;
    if ((fotosM > 0) !== (fotosBest > 0)) return fotosM > 0 ? m : best;
    return m.label.length > best.label.length ? m : best;
  });
}

/**
 * Agrupa itens manuais com nomes parecidos (possíveis duplicatas de digitação).
 * Itens com atributos explicitamente diferentes (cor, material, medidas, c/ vs s/)
 * nunca caem no mesmo grupo.
 */
export function clusterSimilarManualItems(items, foundMap, { minScore = 0.68 } = {}) {
  const enriched = (items || [])
    .filter(isManualItem)
    .map((item) => ({
      item,
      id: item.id,
      label: getItemLabel(item, foundMap),
      marca: getItemMarca(item, foundMap),
      atributos: extractNomeAtributos(getItemLabel(item, foundMap)),
    }))
    .filter((x) => x.label.length >= 4);

  const groups = [];
  const assigned = new Set();
  const sorted = [...enriched].sort((a, b) => b.label.length - a.label.length);

  for (const seed of sorted) {
    if (assigned.has(seed.id)) continue;
    const members = [{ ...seed, score: 1 }];
    assigned.add(seed.id);

    for (const other of enriched) {
      if (assigned.has(other.id)) continue;
      const sim = nomeSimilarity(seed.label, other.label);
      if (sim < minScore) continue;
      // Sem transitividade indevida: o candidato não pode conflitar com NENHUM
      // membro já aceito (ex.: seed "Mesa" não pode juntar "2 gavetas" e "3 gavetas")
      const conflita = members.some(
        (m) => compareNomeAtributos(m.atributos, other.atributos).conflicts.length > 0
      );
      if (conflita) continue;
      members.push({ ...other, score: sim });
      assigned.add(other.id);
    }

    if (members.length >= 2) {
      const ref = pickReferenceMember(members, foundMap);
      groups.push({
        key: ref.id,
        referenceId: ref.id,
        referenceLabel: ref.label,
        referenceItem: ref.item,
        sugestaoNome: sugerirNomePadrao(members, foundMap),
        members: members.map((m) => ({
          item: m.item,
          id: m.id,
          label: m.label,
          marca: m.marca,
          score: m.score ?? 1,
          isReference: m.id === ref.id,
        })),
      });
    }
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

/**
 * Agrupa itens que serão padronizados para o MESMO nome final.
 * Vários itens com o mesmo nome padronizado é normal (ex.: 20 cadeiras iguais).
 */
export function agruparItensParaPadronizacao(items, foundMap, foundSet, { unidadeId, somenteManuais = true, especie } = {}) {
  let list = (items || []).filter((i) => isItemInventariado(i.id, foundSet));
  if (somenteManuais) list = list.filter(isManualItem);
  if (unidadeId && unidadeId !== "todas") {
    list = list.filter((i) => i.unidadeId === unidadeId);
  }
  if (especie && especie !== "todas") {
    list = list.filter((i) => getItemEspecie(i, foundMap) === especie);
  }

  const map = new Map();
  for (const item of list) {
    const labelOriginal = getItemLabel(item, foundMap);
    if (!precisaPadronizacao(labelOriginal)) continue;
    const nomePadronizado = padronizarNome(labelOriginal);
    if (!map.has(nomePadronizado)) {
      map.set(nomePadronizado, { key: nomePadronizado, nomePadronizado, members: [] });
    }
    map.get(nomePadronizado).members.push({
      item,
      id: item.id,
      labelOriginal,
      nomePadronizado,
      marca: getItemMarca(item, foundMap),
    });
  }

  return [...map.values()].sort((a, b) => b.members.length - a.members.length);
}

export const FILTRO_PROBLEMA = {
  TODOS: "todos",
  ABREVIACAO: "abreviacao",
  MAIUSCULAS: "maiusculas",
  SEM_FOTO: "sem_foto",
  SEM_ESPECIE: "sem_especie",
  BAIXA_QUALIDADE: "baixa_qualidade",
  PRECISA_PADRONIZAR: "precisa_padronizar",
};

export const ESTADO_LISTA = {
  PENDENTES: "pendentes",
  CORRIGIDOS: "corrigidos",
};

/** Problemas de grafia/formatação no nome de um item manual. */
export function detectProblemasNome(item, foundMap) {
  const label = getItemLabel(item, foundMap);
  const problemas = [];
  if (!label || label.length < 4) {
    problemas.push({ id: "curto", label: "Nome muito curto", severidade: "alta" });
  }
  if (/\b[csp]\//i.test(label)) {
    problemas.push({ id: "abreviacao", label: "Abreviação (c/, s/, p/)", severidade: "media" });
  }
  if (label.length > 4 && label === label.toUpperCase() && /[A-Z]/.test(label)) {
    problemas.push({ id: "maiusculas", label: "Todo em MAIÚSCULAS", severidade: "media" });
  }
  if (label.length > 4 && label === label.toLowerCase()) {
    problemas.push({ id: "minusculas", label: "Todo em minúsculas", severidade: "baixa" });
  }
  if (/[^\w\sáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ.,/\-+%]/.test(label)) {
    problemas.push({ id: "caracteres", label: "Caracteres incomuns", severidade: "baixa" });
  }
  if (!getItemFotos(item.id, foundMap).length) {
    problemas.push({ id: "sem_foto", label: "Sem foto", severidade: "baixa" });
  }
  const esp = String(item.especie || getFoundEntry(item.id, foundMap)?.especieEdit || "").trim();
  if (!esp || esp === "—") {
    problemas.push({ id: "sem_especie", label: "Espécie não definida", severidade: "media" });
  }
  if (precisaPadronizacao(label)) {
    problemas.push({ id: "precisa_padronizar", label: "Grafia não padronizada", severidade: "media" });
  }
  return problemas;
}

/** Pontuação 0–100: quanto maior, melhor o nome. */
export function computeNomeQualityScore(item, foundMap) {
  const label = getItemLabel(item, foundMap);
  let score = 100;
  const problemas = detectProblemasNome(item, foundMap);
  for (const p of problemas) {
    if (p.severidade === "alta") score -= 28;
    else if (p.severidade === "media") score -= 14;
    else score -= 6;
  }
  const palavras = normalizeMatchText(expandNomeAbreviacoes(label)).split(" ").filter(Boolean).length;
  if (palavras < 2) score -= 10;
  if (getItemFotos(item.id, foundMap).length) score += 5;
  if (/[áéíóúâêôãõç]/i.test(label)) score += 3;
  return Math.max(0, Math.min(100, score));
}

/** KPIs do painel de padronização (por padrão só manuais — tombo já vem padronizado). */
export function buildCorrecaoDashboard(items, foundMap, foundSet, lotes = [], { somenteManuais = true } = {}) {
  let inventariados = (items || []).filter((i) => isItemInventariado(i.id, foundSet));
  if (somenteManuais) inventariados = inventariados.filter(isManualItem);
  let comProblema = 0;
  let semFoto = 0;
  let comAbrev = 0;
  let baixaQualidade = 0;
  let precisaPadronizar = 0;
  let jaPadronizados = 0;
  const especiesPendentes = new Set();
  for (const item of inventariados) {
    const label = getItemLabel(item, foundMap);
    const probs = detectProblemasNome(item, foundMap);
    if (probs.length) comProblema++;
    if (!getItemFotos(item.id, foundMap).length) semFoto++;
    if (probs.some((p) => p.id === "abreviacao")) comAbrev++;
    if (computeNomeQualityScore(item, foundMap) < 55) baixaQualidade++;
    if (precisaPadronizacao(label)) {
      precisaPadronizar++;
      especiesPendentes.add(getItemEspecie(item, foundMap));
    } else {
      jaPadronizados++;
    }
  }
  const itensPadronizaveis = (lotes || []).reduce((acc, g) => acc + g.members.length, 0);
  return {
    total: inventariados.length,
    comProblema,
    precisaPadronizar,
    jaPadronizados,
    lotes: lotes.length,
    itensPadronizaveis,
    semFoto,
    comAbrev,
    baixaQualidade,
    especiesPendentes: especiesPendentes.size,
    somenteManuais,
  };
}

/** Diff palavra a palavra para preview antes/depois. */
export function diffNomePalavras(antes, depois) {
  const a = normalizeMatchText(expandNomeAbreviacoes(antes)).split(" ").filter(Boolean);
  const b = normalizeMatchText(expandNomeAbreviacoes(depois)).split(" ").filter(Boolean);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const antesOut = [];
  const depoisOut = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      antesOut.unshift({ text: a[i - 1], type: "same" });
      depoisOut.unshift({ text: b[j - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      depoisOut.unshift({ text: b[j - 1], type: "added" });
      j--;
    } else {
      antesOut.unshift({ text: a[i - 1], type: "removed" });
      i--;
    }
  }
  return { antes: antesOut, depois: depoisOut };
}

function matchesFiltroProblema(item, foundMap, filtro) {
  if (!filtro || filtro === FILTRO_PROBLEMA.TODOS) return true;
  const probs = detectProblemasNome(item, foundMap);
  if (filtro === FILTRO_PROBLEMA.BAIXA_QUALIDADE) {
    return computeNomeQualityScore(item, foundMap) < 55;
  }
  if (filtro === FILTRO_PROBLEMA.PRECISA_PADRONIZAR) {
    return precisaPadronizacao(getItemLabel(item, foundMap));
  }
  return probs.some((p) => p.id === filtro);
}

export function filterInventariadosItems(
  items,
  foundMap,
  foundSet,
  { unidadeId, query, filtroProblema, estadoLista, somenteManuais = true, especie } = {}
) {
  let list = (items || []).filter((i) => isItemInventariado(i.id, foundSet));
  // Itens do tombo/planilha já vêm com nome de catálogo — correção é para manuais.
  if (somenteManuais) list = list.filter(isManualItem);
  if (unidadeId && unidadeId !== "todas") {
    list = list.filter((i) => i.unidadeId === unidadeId);
  }
  if (especie && especie !== "todas") {
    list = list.filter((i) => getItemEspecie(i, foundMap) === especie);
  }
  const q = String(query || "").trim().toLowerCase();
  if (q) {
    list = list.filter((i) => {
      const label = getItemLabel(i, foundMap).toLowerCase();
      const marca = getItemMarca(i, foundMap).toLowerCase();
      const esp = getItemEspecie(i, foundMap).toLowerCase();
      return label.includes(q) || marca.includes(q) || esp.includes(q) || String(i.id).toLowerCase().includes(q);
    });
  }
  // Filtros de problema físico (ex.: sem foto) mostram TODOS os itens com o
  // problema — inclusive os de nome já padronizado, que sairiam da lista
  // "pendentes" e ficariam sem lugar para correção.
  const filtroIgnoraPendencia = filtroProblema === FILTRO_PROBLEMA.SEM_FOTO;
  if (estadoLista === ESTADO_LISTA.PENDENTES && !filtroIgnoraPendencia) {
    list = list.filter((i) => precisaPadronizacao(getItemLabel(i, foundMap)));
  } else if (estadoLista === ESTADO_LISTA.CORRIGIDOS) {
    list = list.filter((i) => !precisaPadronizacao(getItemLabel(i, foundMap)));
  }
  if (filtroProblema && filtroProblema !== FILTRO_PROBLEMA.TODOS) {
    list = list.filter((i) => matchesFiltroProblema(i, foundMap, filtroProblema));
  }
  if (estadoLista === ESTADO_LISTA.CORRIGIDOS) {
    return list.sort((a, b) => {
      const ea = getItemEspecie(a, foundMap).localeCompare(getItemEspecie(b, foundMap), "pt-BR");
      if (ea !== 0) return ea;
      return getItemLabel(a, foundMap).localeCompare(getItemLabel(b, foundMap), "pt-BR");
    });
  }
  return list.sort((a, b) => {
    const ea = getItemEspecie(a, foundMap).localeCompare(getItemEspecie(b, foundMap), "pt-BR");
    if (ea !== 0) return ea;
    const qa = computeNomeQualityScore(a, foundMap);
    const qb = computeNomeQualityScore(b, foundMap);
    if (qa !== qb) return qa - qb;
    return getItemLabel(a, foundMap).localeCompare(getItemLabel(b, foundMap), "pt-BR");
  });
}

/** @deprecated Use filterInventariadosItems */
export function filterManualItems(items, foundMap, { unidadeId, query, filtroProblema, foundSet } = {}) {
  if (foundSet) return filterInventariadosItems(items, foundMap, foundSet, { unidadeId, query, filtroProblema });
  let list = (items || []).filter(isManualItem);
  if (unidadeId && unidadeId !== "todas") {
    list = list.filter((i) => i.unidadeId === unidadeId);
  }
  const q = String(query || "").trim().toLowerCase();
  if (q) {
    list = list.filter((i) => {
      const label = getItemLabel(i, foundMap).toLowerCase();
      const marca = getItemMarca(i, foundMap).toLowerCase();
      return label.includes(q) || marca.includes(q) || String(i.id).toLowerCase().includes(q);
    });
  }
  if (filtroProblema && filtroProblema !== FILTRO_PROBLEMA.TODOS) {
    list = list.filter((i) => matchesFiltroProblema(i, foundMap, filtroProblema));
  }
  return list.sort((a, b) => {
    const qa = computeNomeQualityScore(a, foundMap);
    const qb = computeNomeQualityScore(b, foundMap);
    if (qa !== qb) return qa - qb;
    return getItemLabel(a, foundMap).localeCompare(getItemLabel(b, foundMap), "pt-BR");
  });
}
