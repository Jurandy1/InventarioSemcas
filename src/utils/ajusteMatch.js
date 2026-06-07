import { sortByDataNF } from "./itemHelpers.js";

function stripDiacritics(s) {
  const str = String(s ?? "");
  if (typeof str.normalize === "function") {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return str;
}

export function normalizeMatchText(s) {
  return stripDiacritics(String(s ?? ""))
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchWords(text) {
  return normalizeMatchText(text)
    .split(" ")
    .filter((w) => w.length > 2);
}

/** Sobreposição de palavras entre dois textos (0–1). */
export function textSimilarity(a, b) {
  const wa = matchWords(a);
  const wb = matchWords(b);
  if (!wa.length || !wb.length) return 0;
  const setB = new Set(wb);
  let hit = 0;
  for (const w of wa) {
    if (setB.has(w)) hit++;
  }
  return hit / Math.max(wa.length, wb.length);
}

/** Compara marcas / fornecedores (RM MOVEIS, etc.). */
export function labelSimilarity(a, b) {
  const na = normalizeMatchText(a);
  const nb = normalizeMatchText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return textSimilarity(a, b);
}

function normalizeNf(nf) {
  return normalizeMatchText(String(nf || "").replace(/^nf\s*/i, ""));
}

export function getAjusteSignals(ajusteItem, foundEntry) {
  return {
    descricao: foundEntry?.descricaoEdit || ajusteItem?.descricao || ajusteItem?.especie || "",
    marca: foundEntry?.marca || ajusteItem?.marca || "",
    tomboReferencia: String(foundEntry?.tomboReferencia || "").trim(),
    nf: String(foundEntry?.nf || ajusteItem?.nf || "").trim(),
    empenho: String(foundEntry?.empenho || ajusteItem?.empenho || "").trim(),
    especie: foundEntry?.especieEdit || ajusteItem?.especie || "",
  };
}

/**
 * Pontua compatibilidade entre registro manual/foto e tombo da planilha.
 * Prioriza marca, depois descrição e fornecedor.
 */
export function scoreTomboMatch(ajusteItem, foundEntry, tomboItem) {
  const sig = getAjusteSignals(ajusteItem, foundEntry);
  const reasons = [];
  let score = 0;

  const marcaSim = labelSimilarity(sig.marca, tomboItem?.marca || "");
  if (marcaSim >= 0.5) {
    score += Math.round(marcaSim * 45);
    reasons.push("Marca");
  }

  const descTarget = `${tomboItem?.descricao || ""} ${tomboItem?.especie || ""}`.trim();
  const descSim = textSimilarity(sig.descricao, descTarget);
  if (descSim >= 0.2) {
    score += Math.round(descSim * 35);
    reasons.push("Descrição");
  }

  const fornSim = labelSimilarity(sig.marca, tomboItem?.fornecedor || "");
  if (marcaSim >= 0.5 && fornSim >= 0.4) {
    score += Math.round(fornSim * 15);
    reasons.push("Fornecedor");
  }

  if (sig.tomboReferencia) {
    const ref = normalizeMatchText(sig.tomboReferencia);
    const tid = normalizeMatchText(tomboItem?.id || tomboItem?.patrimonioLabel || "");
    if (ref && tid && (ref === tid || tid.includes(ref) || ref.includes(tid))) {
      score += 25;
      reasons.push("Tombo indicado");
    }
  }

  const espSim = textSimilarity(sig.especie || sig.descricao, tomboItem?.especie || "");
  if (espSim >= 0.35) {
    score += Math.round(espSim * 22);
    reasons.push("Espécie");
  }

  const nfTombo = normalizeNf(tomboItem?.nf);
  const nfSig = normalizeNf(sig.nf);
  if (nfTombo && nfSig && nfTombo === nfSig) {
    score += 20;
    reasons.push("NF");
  } else if (nfTombo && nfTombo.length >= 4) {
    const descNorm = normalizeMatchText(sig.descricao);
    if (descNorm.includes(nfTombo)) {
      score += 12;
      reasons.push("NF na descrição");
    }
  }

  const empSim = labelSimilarity(sig.empenho, tomboItem?.empenho || "");
  if (empSim >= 0.55) {
    score += Math.round(empSim * 12);
    reasons.push("Empenho");
  }

  const fornDirect = labelSimilarity(sig.marca, tomboItem?.fornecedor || "");
  if (fornDirect >= 0.5 && marcaSim < 0.5) {
    score += Math.round(fornDirect * 18);
    reasons.push("Fornecedor");
  }

  return {
    score: Math.min(100, score),
    reasons: [...new Set(reasons)],
    marcaSim,
    descSim,
  };
}

export function rankTombosForAjuste(ajusteItem, foundEntry, tombos = [], { minScore = 12, limit = 5 } = {}) {
  const ranked = (tombos || [])
    .map((item) => ({
      item,
      ...scoreTomboMatch(ajusteItem, foundEntry, item),
    }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || sortByDataNF(a.item, b.item));

  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}

export function sortTombosByAjusteMatch(tombos, ajusteItem, foundEntry) {
  if (!ajusteItem) return tombos || [];
  const scores = new Map(
    rankTombosForAjuste(ajusteItem, foundEntry, tombos, { minScore: 0, limit: Infinity }).map((r) => [r.item.id, r.score])
  );
  return [...(tombos || [])].sort((a, b) => {
    const ds = (scores.get(b.id) || 0) - (scores.get(a.id) || 0);
    if (ds !== 0) return ds;
    return sortByDataNF(a, b);
  });
}
