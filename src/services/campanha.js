import { fsGetDoc, fsSet } from "./firebase.js";

export const CAMPANHA_DOC_ID = "ativa";

export async function loadCampanhaAtiva() {
  try {
    const doc = await fsGetDoc("campanhas", CAMPANHA_DOC_ID);
    if (doc) return { ...doc, id: CAMPANHA_DOC_ID };
  } catch {}
  return {
    id: CAMPANHA_DOC_ID,
    nome: "Inventário atual",
    status: "aberta",
    inicio: null,
    unidadeIds: [],
  };
}

export function isCampanhaFechada(campanha) {
  return campanha?.status === "fechada";
}

export async function garantirCampanhaAberta(unidadeIds = [], criadoPor = "") {
  const atual = await loadCampanhaAtiva();
  if (atual.inicio) return atual;
  const doc = {
    nome: "Inventário atual",
    status: "aberta",
    inicio: new Date().toISOString(),
    unidadeIds: Array.isArray(unidadeIds) ? unidadeIds : [],
    criadoPor: criadoPor || "",
  };
  await fsSet("campanhas", CAMPANHA_DOC_ID, doc);
  return { id: CAMPANHA_DOC_ID, ...doc };
}

export async function fecharCampanha(fechadoPor = "") {
  const atual = await loadCampanhaAtiva();
  await fsSet("campanhas", CAMPANHA_DOC_ID, {
    ...atual,
    status: "fechada",
    fim: new Date().toISOString(),
    fechadoPor,
  });
}

export async function reabrirCampanha(reabertoPor = "") {
  await fsSet("campanhas", CAMPANHA_DOC_ID, {
    nome: "Inventário atual",
    status: "aberta",
    inicio: new Date().toISOString(),
    fim: null,
    fechadoPor: null,
    reabertoPor,
    reabertoEm: new Date().toISOString(),
    unidadeIds: [],
  });
}
