import { fsGetAll, fsSet } from "./firebase.js";
import { isItemInventariado } from "../utils/patrimonioId.js";

export function buildFinalizacaoStats(units, foundSet) {
  const allItens = (units || []).flatMap((u) => u.itens || []);
  const totalBens = allItens.length;
  const totalFound = allItens.filter((i) => isItemInventariado(i.id, foundSet)).length;
  return {
    totalBens,
    totalFound,
    totalNE: Math.max(0, totalBens - totalFound),
    progresso: totalBens > 0 ? Math.round((totalFound / totalBens) * 100) : 0,
  };
}

export async function criarFinalizacao({
  unidadeIds = [],
  unidadeNomes = [],
  sessionId = "",
  coordenadora = {},
  conviteToken = "",
  stats = {},
  finalizedBy = {},
  campanhaId = "ativa",
}) {
  if (sessionId || unidadeIds.length > 0) {
    try {
      const existentes = await fsGetAll("finalizacoes");
      // Check both by sessionId AND by unitIds to prevent duplicates
      const hit = existentes?.find((d) => {
        if (d.sessionId && d.sessionId === sessionId) return true;
        const dUnitIds = (d.unidadeIds || []).sort().join(',');
        const newUnitIds = unidadeIds.sort().join(',');
        if (dUnitIds && dUnitIds === newUnitIds) return true;
        return false;
      });
      
      if (hit) {
        console.log(`[criarFinalizacao] Finalização já existe para essas unidades ou sessão. Ignorando duplicação.`, hit.id);
        return { id: hit.id || hit._id, ...hit };
      }
    } catch (e) {
      console.warn("Erro ao checar duplicatas de finalização:", e);
    }
  }

  const id = `fin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const doc = {
    campanhaId,
    unidadeIds,
    unidadeNomes,
    sessionId,
    finalizedAt: new Date().toISOString(),
    finalizedBy,
    coordenadora: {
      nome: coordenadora?.nome || "",
      matricula: coordenadora?.matricula || "",
    },
    conviteToken,
    stats: {
      totalBens: stats.totalBens || 0,
      totalFound: stats.totalFound || 0,
      totalNE: stats.totalNE || 0,
      progresso: stats.progresso || 0,
    },
    status: "finalizado",
    ultimaEdicao: null,
  };
  await fsSet("finalizacoes", id, doc);
  return { id, ...doc };
}

export async function listFinalizacoes() {
  try {
    const docs = await fsGetAll("finalizacoes");
    return (docs || [])
      .map((d) => ({ ...d, id: d.id || d._id }))
      .sort((a, b) => String(b.finalizedAt || "").localeCompare(String(a.finalizedAt || "")));
  } catch (e) {
    console.warn("listFinalizacoes falhou:", e?.message || e);
    return [];
  }
}

/** Agrupa tombosNE antigos (sem registro em finalizacoes) para exibir na lista. */
export function inferFinalizacoesLegadas(tombosNE = [], unidades = []) {
  const normName = (n) =>
    String(n || "")
      .replace(/^\d+[\d.]*\s*-\s*/, "")
      .trim()
      .toLowerCase();

  const findUnit = (unidadeNome) => {
    const ne = normName(unidadeNome);
    return (unidades || []).find((u) => {
      const un = normName(u.nome);
      return u.nome === unidadeNome || un === ne || un.includes(ne) || ne.includes(un);
    });
  };

  const groups = new Map();
  for (const ne of tombosNE || []) {
    const unidadeNome = String(ne.unidade || ne.unidadeNome || "").trim();
    if (!unidadeNome) continue;
    const dataFin = String(ne.dataFin || "").trim() || "—";
    const coord = String(ne.coordenadora || "").trim();
    const mat = String(ne.matricula || "").trim();
    const unit = findUnit(unidadeNome);
    const key = `${unit?.id || unidadeNome}|${dataFin}|${coord}|${mat}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `legacy_${key.replace(/[^\w]/g, "_").slice(0, 80)}`,
        legacy: true,
        unidadeIds: unit ? [unit.id] : [],
        unidadeNomes: [unit?.nome || unidadeNome],
        finalizedAt: dataFin,
        coordenadora: { nome: coord, matricula: mat },
        stats: { totalNE: 0, totalBens: unit?.itens?.length || 0, totalFound: 0, progresso: 0 },
        status: "finalizado",
      });
    }
    groups.get(key).stats.totalNE += 1;
  }
  return [...groups.values()].sort((a, b) => String(b.finalizedAt).localeCompare(String(a.finalizedAt)));
}

export async function registrarEdicaoFinalizacao(id, editor = {}) {
  if (!id || String(id).startsWith("legacy_")) return;
  try {
    const docs = await fsGetAll("finalizacoes");
    const cur = (docs || []).find((d) => (d.id || d._id) === id);
    if (!cur) return;
    await fsSet("finalizacoes", id, {
      ...cur,
      ultimaEdicao: {
        em: new Date().toISOString(),
        por: editor?.nome || editor?.email || "",
        uid: editor?.uid || "",
      },
    });
  } catch {}
}

export async function atualizarStatsFinalizacao(id, stats) {
  if (!id || String(id).startsWith("legacy_")) return;
  try {
    const docs = await fsGetAll("finalizacoes");
    const cur = (docs || []).find((d) => (d.id || d._id) === id);
    if (!cur) return;
    await fsSet("finalizacoes", id, {
      ...cur,
      stats: { ...cur.stats, ...stats },
    });
  } catch {}
}
