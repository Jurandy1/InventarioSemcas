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
}

export function clearFirebaseSession() {
  authToken = null;
  authUid = null;
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

export async function fsGetDocPublic(collection, docId) {
  assertFirebaseConfigured();
  const id = String(docId || "").trim();
  if (!id) return null;
  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const r = await fetchWithTimeout(`${FS_URL}/${collection}/${encodeURIComponent(id)}?key=${FB.apiKey}`, {}, 12000);
  if (r.status === 404) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(d?.error?.message || d?.error?.status || "");
    if (r.status === 403 || msg.includes("PERMISSION_DENIED") || msg.toLowerCase().includes("permission")) {
      throw new Error(
        "Convite bloqueado pelas regras do Firestore. Confirme que publicou as regras em Firestore → Rules (não são avisos de CSS no console)."
      );
    }
    throw new Error(msg || `Falha ao validar convite (HTTP ${r.status})`);
  }
  return { _id: d.name.split("/").pop(), ...fromFsDoc(d) };
}

export async function fsGetDoc(collection, docId) {
  assertFirebaseConfigured();
  if (!authToken) return null;
  const id = String(docId || "").trim();
  if (!id) return null;
  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const r = await fetchWithTimeout(
    `${FS_URL}/${collection}/${encodeURIComponent(id)}?key=${FB.apiKey}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
    12000
  );
  if (r.status === 404) return null;
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  if (!d?.name) return null;
  return { _id: d.name.split("/").pop(), ...fromFsDoc(d) };
}

function buildStructuredWhere(where) {
  if (!Array.isArray(where) || where.length === 0) return null;

  const filters = where
    .filter(Boolean)
    .map((w) => ({
      fieldFilter: {
        field: { fieldPath: String(w.field || "") },
        op: String(w.op || "EQUAL"),
        value: toFsValue(w.value),
      },
    }))
    .filter((f) => f.fieldFilter.field.fieldPath);

  if (filters.length === 0) return null;
  if (filters.length === 1) return filters[0];
  return { compositeFilter: { op: "AND", filters } };
}

function normalizeOrderBy(orderBy) {
  if (!orderBy) return [];
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy];
  return arr
    .filter(Boolean)
    .map((o) => {
      if (typeof o === "string") return { field: o, direction: "ASCENDING" };
      return { field: String(o.field || ""), direction: String(o.direction || "ASCENDING") };
    })
    .filter((o) => o.field);
}

function ensureNameOrderBy(orderByArr) {
  const hasName = orderByArr.some((o) => o.field === "__name__");
  return hasName ? orderByArr : [...orderByArr, { field: "__name__", direction: "ASCENDING" }];
}

function safeParseJson(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return null;
  }
}

export async function fsQueryPage(collection, opts = {}) {
  assertFirebaseConfigured();
  if (!authToken) return { docs: [], nextCursor: null, hasMore: false };

  const pageSize = Math.max(1, Math.min(1000, Number(opts.pageSize || 200) || 200));
  const limit = Math.max(1, Math.min(1001, pageSize + 1));
  const where = buildStructuredWhere(opts.where);
  const orderByInput = ensureNameOrderBy(normalizeOrderBy(opts.orderBy));
  const cursor = safeParseJson(opts.cursor);

  const structuredQuery = {
    from: [{ collectionId: collection }],
    limit,
    orderBy: orderByInput.map((o) => ({
      field: { fieldPath: o.field },
      direction: o.direction,
    })),
  };

  if (where) structuredQuery.where = where;

  if (cursor?.docName) {
    structuredQuery.startAt = {
      before: false,
      values: orderByInput.map((o) => {
        if (o.field === "__name__") return { referenceValue: String(cursor.docName) };
        return toFsValue(cursor.fields?.[o.field]);
      }),
    };
  }

  const RUN_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents:runQuery`;
  const r = await fetchWithTimeout(
    `${RUN_URL}?key=${FB.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ structuredQuery }),
    },
    20000
  );

  if (!r.ok) {
    const errBody = await r.json().catch(() => ({}));
    console.warn(`Firestore query failed (${collection}):`, errBody?.error?.message || r.status);
    return { docs: [], nextCursor: null, hasMore: false };
  }
  const rows = await r.json().catch(() => []);
  const docsRaw = (Array.isArray(rows) ? rows : []).map((x) => x?.document).filter(Boolean);

  const mapped = docsRaw.map((doc) => ({ _id: doc.name.split("/").pop(), ...fromFsDoc(doc) }));
  const hasMore = mapped.length > pageSize;
  const sliced = hasMore ? mapped.slice(0, pageSize) : mapped;

  let nextCursor = null;
  if (hasMore && docsRaw.length > 0) {
    const lastDoc = docsRaw[Math.min(pageSize - 1, docsRaw.length - 1)];
    const lastData = fromFsDoc(lastDoc) || {};
    const fields = {};
    for (const o of orderByInput) {
      if (o.field === "__name__") continue;
      fields[o.field] = lastData[o.field];
    }
    nextCursor = JSON.stringify({ docName: lastDoc.name, fields });
  }

  return { docs: sliced, nextCursor, hasMore };
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

export async function fsSetStrict(collection, docId, data) {
  assertFirebaseConfigured();
  if (!authToken) throw new Error("Usuário não autenticado");
  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const fields = {};
  for (const k in data) fields[k] = toFsValue(data[k]);
  const r = await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ fields }),
  });
  if (r.ok) return true;
  const d = await r.json().catch(() => ({}));
  const raw = d?.error?.message || `Falha ao salvar em ${collection}/${docId}`;
  if (r.status === 403 || String(raw).includes("PERMISSION_DENIED")) {
    if (collection === "convites_inventariantes") {
      throw new Error(
        "Sem permissão para criar convite. Publique as regras atualizadas do firestore.rules no Firebase Console (Firestore → Regras → Publicar)."
      );
    }
    throw new Error(`Sem permissão no Firestore (${collection}). Verifique se as regras foram publicadas.`);
  }
  throw new Error(raw);
}

export async function fsGetAll(collection) {
  assertFirebaseConfigured();
  if (!authToken) return [];
  const opts = arguments.length > 1 && typeof arguments[1] === "object" ? arguments[1] : {};
  const pageSize = Math.max(1, Math.min(1000, Number(opts.pageSize || 250) || 250));

  if (opts.where || opts.orderBy) {
    const all = [];
    let cursor = opts.cursor || null;
    const max = typeof opts.limit === "number" ? Math.max(0, opts.limit) : Infinity;
    while (all.length < max) {
      const res = await fsQueryPage(collection, { ...opts, pageSize, cursor });
      all.push(...res.docs);
      if (!res.hasMore || res.docs.length === 0) break;
      cursor = res.nextCursor;
    }
    return typeof opts.limit === "number" ? all.slice(0, opts.limit) : all;
  }

  const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
  const out = [];
  let pageToken = opts.pageToken || null;
  const max = typeof opts.limit === "number" ? Math.max(0, opts.limit) : Infinity;

  while (out.length < max) {
    const url = `${FS_URL}/${collection}?key=${FB.apiKey}&pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const r = await fetchWithTimeout(
      url,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
      20000
    );
    if (!r.ok) break;
    const d = await r.json().catch(() => ({}));
    const pageDocs = (d.documents || []).map((doc) => ({ _id: doc.name.split("/").pop(), ...fromFsDoc(doc) }));
    out.push(...pageDocs);
    if (!d.nextPageToken || pageDocs.length === 0) break;
    pageToken = d.nextPageToken;
  }

  return typeof opts.limit === "number" ? out.slice(0, opts.limit) : out;
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

export async function obterCoordenadores(status = "pendente_aprovacao") {
  assertFirebaseConfigured();
  if (!authToken) return [];

  const todosCoord = await fsGetAll("coordenadores");

  if (status === "todos") return todosCoord;
  return todosCoord.filter((c) => c.status === status);
}

export async function obterCoordPorUid(uid) {
  assertFirebaseConfigured();
  if (!authToken || !uid) return null;
  return fsGetDoc("coordenadores", uid);
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
    return await fsGetDoc("inventariantes", uid);
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
  return inv;
}
