import { normalizeMatchText, textSimilarity } from "./ajusteMatch.js";

export function getItemLabel(item, foundMap) {
  const f = foundMap?.[item?.id];
  return String(f?.descricaoEdit || item?.descricao || item?.especie || "").trim();
}

export function isManualItem(item) {
  const id = String(item?.id || "");
  return Boolean(item?.isManual) || id.startsWith("MAN_") || id.startsWith("ST_");
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

/** Similaridade entre nomes (typos, abreviações, palavras em comum). */
export function nomeSimilarity(a, b) {
  const na = normalizeMatchText(a);
  const nb = normalizeMatchText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wordSim = textSimilarity(a, b);
  const levSim = levenshteinRatio(na, nb);
  const contain = na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na)) ? 0.78 : 0;
  return Math.max(wordSim, levSim, contain);
}

function pickReferenceMember(members) {
  return members.reduce((best, m) => (m.label.length > best.label.length ? m : best));
}

/**
 * Agrupa itens manuais com nomes parecidos (possíveis duplicatas de digitação).
 */
export function clusterSimilarManualItems(items, foundMap, { minScore = 0.68 } = {}) {
  const enriched = (items || [])
    .filter(isManualItem)
    .map((item) => ({
      item,
      id: item.id,
      label: getItemLabel(item, foundMap),
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
      if (sim >= minScore) {
        members.push({ ...other, score: sim });
        assigned.add(other.id);
      }
    }

    if (members.length >= 2) {
      const ref = pickReferenceMember(members);
      groups.push({
        key: ref.id,
        referenceId: ref.id,
        referenceLabel: ref.label,
        referenceItem: ref.item,
        members: members.map((m) => ({
          item: m.item,
          id: m.id,
          label: m.label,
          score: m.score ?? 1,
          isReference: m.id === ref.id,
        })),
      });
    }
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

export function filterManualItems(items, foundMap, { unidadeId, query } = {}) {
  let list = (items || []).filter(isManualItem);
  if (unidadeId && unidadeId !== "todas") {
    list = list.filter((i) => i.unidadeId === unidadeId);
  }
  const q = String(query || "").trim().toLowerCase();
  if (q) {
    list = list.filter((i) => {
      const label = getItemLabel(i, foundMap).toLowerCase();
      return label.includes(q) || String(i.id).toLowerCase().includes(q);
    });
  }
  return list.sort((a, b) => getItemLabel(a, foundMap).localeCompare(getItemLabel(b, foundMap), "pt-BR"));
}
