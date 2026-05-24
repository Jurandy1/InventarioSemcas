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

