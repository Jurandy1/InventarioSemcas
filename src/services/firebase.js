const FB = {
  apiKey: import.meta.env.VITE_FB_API_KEY || "",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET || "",
};

export function isFirebaseConfigured() {
  return Boolean(FB.apiKey && FB.projectId && FB.storageBucket);
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured()) {
    const msg = import.meta.env.PROD
      ? "Firebase não configurado no deploy. Configure os secrets do GitHub Actions: VITE_FB_API_KEY, VITE_FB_PROJECT_ID e VITE_FB_STORAGE_BUCKET e faça um redeploy."
      : "Firebase não configurado. Crie um arquivo .env na raiz com VITE_FB_API_KEY, VITE_FB_PROJECT_ID e VITE_FB_STORAGE_BUCKET e reinicie o servidor.";
    throw new Error(
      msg,
    );
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
}

export function clearFirebaseSession() {
  authToken = null;
  authUid = null;
}

export function getFirebaseSession() {
  return { token: authToken, uid: authUid };
}

export async function refreshAuthToken(storedRefreshToken) {
  assertFirebaseConfigured();
  const r = await fetchWithTimeout(`https://securetoken.googleapis.com/v1/token?key=${FB.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${storedRefreshToken}`,
  }, 12000);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Falha ao renovar sessão");
  authToken = d.id_token;
  authUid = d.user_id;
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
    throw new Error(
      d.error.message === "EMAIL_NOT_FOUND"
        ? "Email não encontrado"
        : d.error.message === "INVALID_PASSWORD"
          ? "Senha incorreta"
          : d.error.message === "INVALID_LOGIN_CREDENTIALS"
            ? "Email ou senha incorretos"
            : d.error.message,
    );
  }
  authToken = d.idToken;
  authUid = d.localId;
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
  if (d.error) throw new Error(d.error.message);
  authToken = d.idToken;
  authUid = d.localId;
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
    throw new Error(d.error.message === "EMAIL_EXISTS" ? "Email já cadastrado" : d.error.message);
  }
  authToken = d.idToken;
  authUid = d.localId;
  return {
    uid: d.localId,
    email: d.email,
    nome: d.email.split("@")[0].toUpperCase(),
    token: d.idToken,
    refreshToken: d.refreshToken,
  };
}

function toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFsValue) } };
  if (typeof val === "object") {
    const fields = {};
    for (const k in val) fields[k] = toFsValue(val[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFsValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ("mapValue" in v) {
    const obj = {};
    for (const k in v.mapValue.fields) obj[k] = fromFsValue(v.mapValue.fields[k]);
    return obj;
  }
  return null;
}

function fromFsDoc(doc) {
  if (!doc?.fields) return null;
  const obj = {};
  for (const k in doc.fields) obj[k] = fromFsValue(doc.fields[k]);
  return obj;
}

export async function fsSet(collection, docId, data) {
  assertFirebaseConfigured();
  if (!authToken) return;
  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const fields = {};
  for (const k in data) fields[k] = toFsValue(data[k]);
  await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ fields }),
  });
}

export async function fsGetAll(collection) {
  assertFirebaseConfigured();
  if (!authToken) return [];
  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const r = await fetch(`${FS_URL}/${collection}?key=${FB.apiKey}&pageSize=1000`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.documents || []).map((doc) => ({ _id: doc.name.split("/").pop(), ...fromFsDoc(doc) }));
}

export async function fsDel(collection, docId) {
  assertFirebaseConfigured();
  if (!authToken) return;
  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

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
    criadoPor,
  };

  await fsSet("convites", token, convite);
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

  const convite = await fsGetAll("convites");
  const found = convite.find((c) => c._id === token || c.token === token);
  if (!found) throw new Error("Convite não encontrado");

  found.status = "cancelado";
  await fsSet("convites", found._id, found);
}

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

