function requireEnv(name, value) {
  if (!value) throw new Error(`Config ausente: ${name}`);
  return value;
}

const FB = {
  apiKey: requireEnv("VITE_FB_API_KEY", import.meta.env.VITE_FB_API_KEY),
  projectId: requireEnv("VITE_FB_PROJECT_ID", import.meta.env.VITE_FB_PROJECT_ID),
  storageBucket: requireEnv("VITE_FB_STORAGE_BUCKET", import.meta.env.VITE_FB_STORAGE_BUCKET),
};

const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;
const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;

let authToken = null;
let authUid = null;

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

export async function fbLogin(email, password) {
  const r = await fetch(`${AUTH_URL}:signInWithPassword?key=${FB.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
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

export async function fbRegister(email, password) {
  const r = await fetch(`${AUTH_URL}:signUp?key=${FB.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (d.error) {
    throw new Error(d.error.message === "EMAIL_EXISTS" ? "Email já cadastrado" : d.error.message);
  }
  authToken = d.idToken;
  authUid = d.localId;
  return { uid: d.localId, email: d.email, nome: d.email.split("@")[0].toUpperCase(), token: d.idToken };
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
  if (!authToken) return;
  const fields = {};
  for (const k in data) fields[k] = toFsValue(data[k]);
  await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ fields }),
  });
}

export async function fsGet(collection, docId) {
  if (!authToken) return null;
  const r = await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!r.ok) return null;
  return fromFsDoc(await r.json());
}

export async function fsGetAll(collection) {
  if (!authToken) return [];
  const r = await fetch(`${FS_URL}/${collection}?key=${FB.apiKey}&pageSize=1000`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.documents || []).map((doc) => ({ _id: doc.name.split("/").pop(), ...fromFsDoc(doc) }));
}

export async function fsDel(collection, docId) {
  if (!authToken) return;
  await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

