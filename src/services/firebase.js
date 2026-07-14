import {
  cadastroEmailDocId,
  cadastroMatriculaDocId,
  cadastroNomeDocId,
  isCadastroStatusAtivo,
  montarMensagemDuplicata,
  avaliarNomeSimilar,
  normalizeCadastroMatricula,
} from "../utils/cadastroDedup.js";
import {
  clearSupabaseAccessToken,
  isSupabaseConfigured,
  sbDel,
  sbGetAll,
  sbGetDoc,
  sbGetDocPublic,
  sbQueryPage,
  sbSet,
  sbSetStrict,
  setSupabaseAccessToken,
  useSupabaseForData,
} from "./supabase.js";

export { isSupabaseConfigured };

const FB = {
  apiKey: import.meta.env.VITE_FB_API_KEY || "",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET || "",
};

export function isFirebaseConfigured() {
  return Boolean(FB.apiKey && FB.projectId && FB.storageBucket);
}

/** Dados de inventário só no Supabase. Firebase = login + fotos. */
function assertSupabaseDataBackend() {
  if (!useSupabaseForData()) {
    throw new Error(
      "Supabase não configurado. Dados do inventário só são gravados no Supabase (Firebase fica só para login e fotos)."
    );
  }
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured()) {
    const msg = import.meta.env.PROD
      ? "Firebase não configurado no deploy. Configure VITE_FB_API_KEY, VITE_FB_PROJECT_ID e VITE_FB_STORAGE_BUCKET nas variáveis de ambiente (Vercel ou GitHub Actions) e faça redeploy."
      : "Firebase não configurado. Crie um arquivo .env na raiz com VITE_FB_API_KEY, VITE_FB_PROJECT_ID e VITE_FB_STORAGE_BUCKET e reinicie o servidor.";
    throw new Error(msg);
  }
}

const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;

let authToken = null;
let authUid = null;

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export function setFirebaseSession({ token, uid }) {
  authToken = token || null;
  authUid = uid || null;
  setSupabaseAccessToken(token || null);
}

export function clearFirebaseSession() {
  authToken = null;
  authUid = null;
  clearSupabaseAccessToken();
}

export function getFirebaseSession() {
  return { token: authToken, uid: authUid };
}

export function mapFirebaseAuthError(code) {
  const c = String(code || "").trim();
  if (c === "ADMIN_ONLY_OPERATION") {
    return "Cadastro bloqueado no Firebase. Ative E-mail/Senha em Authentication → Sign-in method (Firebase Console).";
  }
  if (c === "OPERATION_NOT_ALLOWED") {
    return "Este método de login não está habilitado no Firebase Console.";
  }
  if (c === "EMAIL_EXISTS") return "E-mail já cadastrado";
  if (c === "EMAIL_NOT_FOUND") return "E-mail não encontrado";
  if (c === "INVALID_PASSWORD") return "Senha incorreta";
  if (c === "INVALID_LOGIN_CREDENTIALS") return "E-mail ou senha incorretos";
  return c || "Erro de autenticação";
}

export async function refreshAuthToken(storedRefreshToken) {
  assertFirebaseConfigured();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: storedRefreshToken || "",
  }).toString();
  const r = await fetchWithTimeout(
    `https://securetoken.googleapis.com/v1/token?key=${FB.apiKey}`,
    {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    12000
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Falha ao renovar sessão");
  authToken = d.id_token;
  authUid = d.user_id;
  setSupabaseAccessToken(authToken);
  return { token: d.id_token, refreshToken: d.refresh_token, uid: d.user_id };
}

export async function fbLogin(email, password) {
  assertFirebaseConfigured();
  const r = await fetchWithTimeout(`${AUTH_URL}:signInWithPassword?key=${FB.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }, 12000);
  const d = await r.json();
  if (d.error) {
    throw new Error(mapFirebaseAuthError(d.error.message));
  }
  authToken = d.idToken;
  authUid = d.localId;
  setSupabaseAccessToken(authToken);
  return {
    uid: d.localId,
    email: d.email,
    nome: d.email.split("@")[0].toUpperCase(),
    token: d.idToken,
    refreshToken: d.refreshToken,
  };
}

export async function fbAnonymousLogin() {
  assertFirebaseConfigured();
  const r = await fetchWithTimeout(`${AUTH_URL}:signUp?key=${FB.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  }, 12000);
  const d = await r.json();
  if (d.error) throw new Error(mapFirebaseAuthError(d.error.message));
  authToken = d.idToken;
  authUid = d.localId;
  setSupabaseAccessToken(authToken);
  return { uid: d.localId, token: d.idToken, refreshToken: d.refreshToken };
}

export async function fbRegister(email, password) {
  assertFirebaseConfigured();
  const r = await fetchWithTimeout(`${AUTH_URL}:signUp?key=${FB.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }, 12000);
  const d = await r.json();
  if (d.error) {
    throw new Error(mapFirebaseAuthError(d.error.message));
  }
  authToken = d.idToken;
  authUid = d.localId;
  setSupabaseAccessToken(authToken);
  return {
    uid: d.localId,
    email: d.email,
    nome: d.email.split("@")[0].toUpperCase(),
    token: d.idToken,
    refreshToken: d.refreshToken,
  };
}

export async function fsGetDocPublic(collection, docId) {
  assertSupabaseDataBackend();
  return sbGetDocPublic(collection, docId);
}

export async function fsGetDoc(collection, docId) {
  assertSupabaseDataBackend();
  return sbGetDoc(collection, docId);
}

export async function fsQueryPage(collection, opts = {}) {
  assertSupabaseDataBackend();
  return sbQueryPage(collection, opts);
}

export async function fsSet(collection, docId, data) {
  assertSupabaseDataBackend();
  return sbSet(collection, docId, data);
}

export async function fsSetStrict(collection, docId, data) {
  assertSupabaseDataBackend();
  return sbSetStrict(collection, docId, data);
}

export async function fsGetAll(collection) {
  const opts = arguments.length > 1 && typeof arguments[1] === "object" ? arguments[1] : {};
  assertSupabaseDataBackend();
  return sbGetAll(collection, opts);
}

export async function fsDel(collection, docId) {
  assertSupabaseDataBackend();
  return sbDel(collection, docId);
}

// ─── Coordenadores (existing) ─────────────────────────────────────────────────

export async function criarConviteCoordinador(unidadeId, unidadeNome, matricula = "", criadoPor = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const token = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const agora = new Date();
  const dataExpiracao = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const convite = {
    token,
    unidadeId,
    unidadeNome,
    matricula: matricula || "",
    status: "ativo",
    dataCriacao: agora.toISOString(),
    dataExpiracao: dataExpiracao.toISOString(),
    dataUso: null,
    criadoPor: criadoPor || authUid,
  };

  await fsSetStrict("convites", token, convite);
  return convite;
}

export async function obterConvites(filtro = "ativo") {
  assertFirebaseConfigured();
  if (!authToken) return [];

  const todosConvites = await fsGetAll("convites");

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

  const convites = await fsGetAll("convites");
  const found = convites.find((c) => c._id === token || c.token === token);
  if (!found) throw new Error("Convite não encontrado");

  found.status = "cancelado";
  await fsSet("convites", found._id, found);
}

function normalizeCoordStatus(status) {
  // Migração antiga gravava DEFAULT 'pendente'; o app usa 'pendente_aprovacao'.
  if (status === "pendente") return "pendente_aprovacao";
  return status;
}

export async function obterCoordenadores(status = "pendente_aprovacao") {
  assertFirebaseConfigured();
  if (!authToken) return [];

  const todosCoord = (await fsGetAll("coordenadores")).map((c) => ({
    ...c,
    status: normalizeCoordStatus(c.status),
  }));

  if (status === "todos") return todosCoord;
  return todosCoord.filter((c) => c.status === status);
}

export async function obterCoordPorUid(uid) {
  assertFirebaseConfigured();
  if (!authToken || !uid) return null;
  const direto = await fsGetDoc("coordenadores", uid);
  if (direto) return { ...direto, status: normalizeCoordStatus(direto.status) };
  // Fallback: procura na lista completa (registros antigos podem ter uid só no _id)
  try {
    const todos = await fsGetAll("coordenadores");
    const found = todos.find((c) => c.uid === uid || c._id === uid) || null;
    return found ? { ...found, status: normalizeCoordStatus(found.status) } : null;
  } catch {
    return null;
  }
}

export async function obterCoordPorUnidade(unidadeId) {
  assertFirebaseConfigured();
  const rows = await fsGetAll("coordenadores", {
    where: [
      { field: "unidadeId", op: "EQUAL", value: unidadeId },
      { field: "status", op: "EQUAL", value: "aprovada" },
    ],
    orderBy: ["__name__"],
  });
  return rows;
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
  try {
    await atualizarStatusCadastroIndice(coord, "coordenador", "aprovada");
  } catch (e) {
    console.warn("Índice de cadastro não atualizado:", e);
  }
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
  try {
    await atualizarStatusCadastroIndice(coord, "coordenador", "rejeitada");
  } catch (e) {
    console.warn("Índice de cadastro não atualizado:", e);
  }
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
  try {
    await atualizarStatusCadastroIndice(coord, "coordenador", "desativada");
  } catch (e) {
    console.warn("Índice de cadastro não atualizado:", e);
  }
  return coord;
}

export async function gerarLinkConviteCoordinador(unidadeId, unidadeNome, matricula = "") {
  const convite = await criarConviteCoordinador(unidadeId, unidadeNome, matricula, authUid);
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const link = `${window.location.origin}${prefix}#/coordregistro/${convite.token}`;
  return { convite, link };
}

// ─── Inventariantes (new) ─────────────────────────────────────────────────────

export async function criarConviteInventariante(criadoPor = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const agora = new Date();
  const dataExpiracao = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const convite = {
    token,
    status: "ativo",
    dataCriacao: agora.toISOString(),
    dataExpiracao: dataExpiracao.toISOString(),
    dataUso: null,
    criadoPor: criadoPor || authUid,
  };

  await fsSetStrict("convites_inventariantes", token, convite);
  return convite;
}

/** Marca convite de inventariante como usado após cadastro (requer auth do novo usuário). */
export async function marcarConviteInventarianteUsado(token, convite, uid) {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");
  await fsSetStrict("convites_inventariantes", token, {
    ...convite,
    status: "usado",
    dataUso: new Date().toISOString(),
    usadoPor: uid,
  });
}

/** Marca convite de coordenadora como usado após cadastro. */
export async function marcarConviteCoordUsado(token, convite) {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");
  await fsSetStrict("convites", token, {
    ...convite,
    status: "usado",
    dataUso: new Date().toISOString(),
  });
}

export async function gerarLinkConviteInventariante() {
  const convite = await criarConviteInventariante(authUid);
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const link = `${window.location.origin}${prefix}#/invregistro/${convite.token}`;
  return { convite, link };
}

export async function obterInventariantes(status = "pendente_aprovacao") {
  assertFirebaseConfigured();
  if (!authToken) return [];
  const todos = await fsGetAll("inventariantes");
  if (status === "todos") return todos;
  return todos.filter((c) => c.status === status);
}

export async function obterInventariantePorUid(uid) {
  assertFirebaseConfigured();
  if (!authToken || !uid) return null;
  try {
    const direto = await fsGetDoc("inventariantes", uid);
    if (direto) return direto;
    const todos = await fsGetAll("inventariantes");
    return todos.find((c) => c.uid === uid || c._id === uid) || null;
  } catch {
    return null;
  }
}

export async function aprovarInventariante(uid, observacoes = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const inv = await obterInventariantePorUid(uid);
  if (!inv) throw new Error("Inventariante não encontrado");

  inv.status = "aprovado";
  inv.dataAprovacao = new Date().toISOString();
  inv.observacoes = observacoes;
  inv.aprovadoPor = authUid;

  await fsSet("inventariantes", inv._id || uid, inv);
  try {
    await atualizarStatusCadastroIndice(inv, "inventariante", "aprovado");
  } catch (e) {
    console.warn("Índice de cadastro não atualizado:", e);
  }
  return inv;
}

export async function rejeitarInventariante(uid, motivo = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const inv = await obterInventariantePorUid(uid);
  if (!inv) throw new Error("Inventariante não encontrado");

  inv.status = "rejeitado";
  inv.dataRejeicao = new Date().toISOString();
  inv.motivoRejeicao = motivo;
  inv.rejeitadoPor = authUid;

  await fsSet("inventariantes", inv._id || uid, inv);
  try {
    await atualizarStatusCadastroIndice(inv, "inventariante", "rejeitado");
  } catch (e) {
    console.warn("Índice de cadastro não atualizado:", e);
  }
  return inv;
}

export async function desativarInventariante(uid, motivo = "") {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");

  const inv = await obterInventariantePorUid(uid);
  if (!inv) throw new Error("Inventariante não encontrado");

  inv.status = "desativado";
  inv.dataDesativacao = new Date().toISOString();
  inv.motivoDesativacao = motivo;
  inv.desativadoPor = authUid;

  await fsSet("inventariantes", inv._id || uid, inv);
  try {
    await atualizarStatusCadastroIndice(inv, "inventariante", "desativado");
  } catch (e) {
    console.warn("Índice de cadastro não atualizado:", e);
  }
  return inv;
}

async function lerIndiceCadastro(docId) {
  if (!docId) return null;
  try {
    return await fsGetDocPublic("cadastro_indice", docId);
  } catch {
    return null;
  }
}

/**
 * Verifica e-mail, matrícula e nome antes do cadastro (leitura pública do índice).
 * @returns {{ blocked: boolean, hits: object[], message: string }}
 */
export async function verificarCadastroDuplicado({ email, matricula, nome, papel, excludeUid } = {}) {
  const hits = [];

  const considerar = (row, tipo, extra = {}) => {
    if (!row || !isCadastroStatusAtivo(row.status)) return;
    if (excludeUid && row.uid === excludeUid) return;
    hits.push({ tipo, ...row, ...extra });
  };

  const [emailRow, matRow] = await Promise.all([
    lerIndiceCadastro(cadastroEmailDocId(email)),
    lerIndiceCadastro(cadastroMatriculaDocId(matricula)),
  ]);

  considerar(emailRow, "email");
  considerar(matRow, "matricula");

  const nomeId = cadastroNomeDocId(nome);
  if (nomeId) {
    const nomeRow = await lerIndiceCadastro(nomeId);
    if (nomeRow && isCadastroStatusAtivo(nomeRow.status) && nomeRow.uid !== excludeUid) {
      const matNova = normalizeCadastroMatricula(matricula);
      const matExistente = normalizeCadastroMatricula(nomeRow.matricula);
      const aval = avaliarNomeSimilar(nome, nomeRow);
      if (aval?.tipo === "nome" || (aval && matNova === matExistente)) {
        considerar(nomeRow, "nome");
      } else if (aval?.tipo === "nome_similar" && matNova !== matExistente) {
        considerar(nomeRow, "nome_similar", { similaridade: aval.similaridade });
      }
    }
  }

  const blocked = hits.length > 0;
  return {
    blocked,
    hits,
    message: blocked ? montarMensagemDuplicata(hits, papel) : "",
  };
}

/** Grava índice anti-duplicação (e-mail, matrícula e nome). */
export async function registrarCadastroIndice({ uid, email, matricula, nome, papel, status }) {
  if (!uid || !email?.trim()) return;

  const base = {
    uid,
    email: String(email).trim(),
    matricula: String(matricula || "").trim(),
    nome: String(nome || "").trim(),
    papel,
    status: status || "pendente_aprovacao",
    atualizadoEm: new Date().toISOString(),
  };

  const writes = [];
  const emailId = cadastroEmailDocId(email);
  if (emailId) writes.push(fsSetStrict("cadastro_indice", emailId, { ...base, chave: "email" }));

  const matId = cadastroMatriculaDocId(matricula);
  if (matId) writes.push(fsSetStrict("cadastro_indice", matId, { ...base, chave: "matricula" }));

  const nomeId = cadastroNomeDocId(nome);
  if (nomeId) writes.push(fsSetStrict("cadastro_indice", nomeId, { ...base, chave: "nome" }));

  await Promise.all(writes);
}

/** Atualiza status no índice após aprovação/rejeição/desativação. */
export async function atualizarStatusCadastroIndice(usuario, papel, status) {
  if (!usuario?.uid || !usuario?.email) return;
  await registrarCadastroIndice({
    uid: usuario.uid,
    email: usuario.email,
    matricula: usuario.matricula,
    nome: usuario.nome,
    papel,
    status,
  });
}

/** Reconstrói índice a partir de inventariantes e coordenadores (admin). */
export async function sincronizarIndiceCadastro() {
  assertFirebaseConfigured();
  if (!authToken) return { total: 0 };

  const [invs, coords] = await Promise.all([
    obterInventariantes("todos"),
    obterCoordenadores("todos"),
  ]);

  let total = 0;
  for (const inv of invs) {
    if (!inv.uid || !inv.email) continue;
    await registrarCadastroIndice({
      uid: inv.uid,
      email: inv.email,
      matricula: inv.matricula,
      nome: inv.nome,
      papel: "inventariante",
      status: inv.status,
    });
    total++;
  }
  for (const coord of coords) {
    if (!coord.uid || !coord.email) continue;
    await registrarCadastroIndice({
      uid: coord.uid,
      email: coord.email,
      matricula: coord.matricula,
      nome: coord.nome,
      papel: "coordenador",
      status: coord.status,
    });
    total++;
  }
  return { total };
}
