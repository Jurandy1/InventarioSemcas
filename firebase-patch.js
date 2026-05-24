// ADICIONAR ESSAS FUNÇÕES AO ARQUIVO src/services/firebase.js

// ===== GERENCIAR CONVITES =====

export async function criarConviteCoordinador(unidadeId, unidadeNome, matricula = "", criadoPor = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const token = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const agora = new Date();
  const dataExpiracao = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias

  const convite = {
    token,
    unidadeId,
    unidadeNome,
    matricula: matricula || "",
    status: "ativo", // ativo, usado, expirado, cancelado
    dataCriacao: agora.toISOString(),
    dataExpiracao: dataExpiracao.toISOString(),
    dataUso: null,
    criadoPor,
  };

  await fsSet("convites", token, convite);
  return convite;
}

export async function obterConvites(filtro = "ativo") {
  assertFirebaseConfigured();
  if (!authToken) return [];

  const todosConvites = await fsGetAll("convites");

  // Limpar convites expirados
  for (const convite of todosConvites) {
    if (convite.status === "ativo" && new Date(convite.dataExpiracao) < new Date()) {
      convite.status = "expirado";
      await fsSet("convites", convite._id, convite);
    }
  }

  if (filtro === "todos") return todosConvites;
  return todosConvites.filter((c) => c.status === filtro);
}

export async function cancelarConvite(token) {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const convite = await fsGetAll("convites");
  const found = convite.find((c) => c._id === token || c.token === token);
  if (!found) throw new Error("Convite não encontrado");

  found.status = "cancelado";
  await fsSet("convites", found._id, found);
}

// ===== GERENCIAR COORDENADORES =====

export async function obterCoordenadores(status = "pendente_aprovacao") {
  assertFirebaseConfigured();
  if (!authToken) return [];

  const todosCoord = await fsGetAll("coordenadores");

  if (status === "todos") return todosCoord;
  return todosCoord.filter((c) => c.status === status);
}

export async function obterCoordPorUid(uid) {
  assertFirebaseConfigured();
  const todosCoord = await fsGetAll("coordenadores");
  return todosCoord.find((c) => c.uid === uid) || null;
}

export async function obterCoordPorUnidade(unidadeId) {
  assertFirebaseConfigured();
  const todosCoord = await fsGetAll("coordenadores");
  return todosCoord.filter((c) => c.unidadeId === unidadeId && c.status === "aprovada");
}

export async function aprovarCoordenador(uid, observacoes = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const coord = await obterCoordPorUid(uid);
  if (!coord) throw new Error("Coordenadora não encontrada");

  coord.status = "aprovada";
  coord.dataAprovacao = new Date().toISOString();
  coord.observacoes = observacoes;
  coord.aprovadoPor = authUid;

  await fsSet("coordenadores", coord._id || uid, coord);
  return coord;
}

export async function rejeitarCoordenador(uid, motivo = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const coord = await obterCoordPorUid(uid);
  if (!coord) throw new Error("Coordenadora não encontrada");

  coord.status = "rejeitada";
  coord.dataRejeicao = new Date().toISOString();
  coord.motivoRejeicao = motivo;
  coord.rejeitadaPor = authUid;

  await fsSet("coordenadores", coord._id || uid, coord);
  return coord;
}

export async function desativarCoordenador(uid, motivo = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const coord = await obterCoordPorUid(uid);
  if (!coord) throw new Error("Coordenadora não encontrada");

  coord.status = "desativada";
  coord.dataDesativacao = new Date().toISOString();
  coord.motivoDesativacao = motivo;
  coord.desativadaPor = authUid;

  await fsSet("coordenadores", coord._id || uid, coord);
  return coord;
}

export async function gerarLinkConviteCoordinador(unidadeId, unidadeNome, matricula = "") {
  const convite = await criarConviteCoordinador(unidadeId, unidadeNome, matricula, authUid);
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const link = `${window.location.origin}${prefix}#/coordregistro/${convite.token}`;
  return { convite, link };
}
