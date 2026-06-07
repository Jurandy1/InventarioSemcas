import { normalizePatrimonioId, patrimonioIdsMatch } from "./patrimonioId.js";
import { isSemTomboItem } from "./semTombo.js";

function buildPlanilhaIdSet(units, activeUnitIds = []) {
  const unitSet = new Set(activeUnitIds || []);
  const byUnit = new Map();
  const all = new Set();
  for (const u of units || []) {
    if (unitSet.size && !unitSet.has(u.id)) continue;
    const ids = new Set();
    for (const it of u.itens || []) {
      ids.add(String(it.id));
      ids.add(normalizePatrimonioId(it.id));
    }
    byUnit.set(u.id, ids);
    ids.forEach((x) => all.add(x));
  }
  return { byUnit, all };
}

function inPlanilha(id, planilhaSet) {
  if (!id || !planilhaSet) return false;
  const s = String(id);
  return planilhaSet.has(s) || planilhaSet.has(normalizePatrimonioId(s));
}

/** Itens encontrados cujo tombo (registro ou etiqueta) não consta na planilha da unidade. */
export function getTombosDivergentes(foundMap, units, activeUnitIds = []) {
  const { byUnit, all } = buildPlanilhaIdSet(units, activeUnitIds);
  const unitSet = new Set(activeUnitIds || []);
  const out = [];

  for (const rawId in foundMap || {}) {
    const f = foundMap[rawId];
    if (!f) continue;
    const uid = f.unidadeId;
    if (unitSet.size && uid && !unitSet.has(uid)) continue;
    if (f.tomboEstrangeiroOk) continue;

    const pid = String(f.patrimonioId || rawId || "");
    const planilha = uid ? byUnit.get(uid) || all : all;
    const ref = String(f.tomboReferencia || "").trim();
    const reasons = [];

    const pidInPlanilha = inPlanilha(pid, planilha);
    const refInPlanilha = ref ? inPlanilha(ref, planilha) : false;

    if (!pid.startsWith("ST_") && !pidInPlanilha) {
      reasons.push("Nº registrado não está na planilha desta unidade");
    }

    if (ref && !refInPlanilha && !patrimonioIdsMatch(ref, pid)) {
      reasons.push(`Etiqueta indica Nº ${ref} (fora da planilha)`);
    }

    if (pidInPlanilha && ref && !refInPlanilha && !patrimonioIdsMatch(ref, pid)) {
      reasons.push(`Etiqueta ${ref} ≠ tombo da planilha (${pid})`);
    }

    if (String(pid).startsWith("ST_") && ref && !refInPlanilha) {
      reasons.push(`Sem tombo — etiqueta ${ref} não consta na planilha`);
    }

    if (!reasons.length) continue;

    const item = (units || [])
      .flatMap((u) => (u.itens || []).map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome })))
      .find((i) => i.id === pid || patrimonioIdsMatch(i.id, pid));

    out.push({
      id: pid,
      f,
      item: item || null,
      tomboLabel: ref || item?.patrimonioLabel || pid,
      reasons,
      semTombo: isSemTomboItem(item, f),
    });
  }

  return out.sort((a, b) => String(a.f?.ultimaAtualizacao || "").localeCompare(String(b.f?.ultimaAtualizacao || "")));
}

export const TOMBO_DIVERGENTE_BADGE = { bg: "#fce7f3", tx: "#be185d", label: "Tombo divergente" };
