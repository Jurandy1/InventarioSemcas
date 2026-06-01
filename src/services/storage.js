import { getFirebaseSession, isFirebaseConfigured } from "./firebase.js";

const BUCKET = import.meta.env.VITE_FB_STORAGE_BUCKET || "";
const BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

export const isStorageOk = () => isFirebaseConfigured() && !!BUCKET;

const displayUrlCache = new Map();
const displayUrlOrder = [];

function makeDownloadToken() {
  try {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function pickDownloadToken(uploadJson) {
  const fromTop = typeof uploadJson?.downloadTokens === "string" ? uploadJson.downloadTokens : "";
  if (fromTop) return fromTop.split(",")[0];
  const fromMeta = typeof uploadJson?.metadata?.firebaseStorageDownloadTokens === "string" ? uploadJson.metadata.firebaseStorageDownloadTokens : "";
  if (fromMeta) return fromMeta.split(",")[0];
  const altTop = typeof uploadJson?.downloadtokens === "string" ? uploadJson.downloadtokens : "";
  if (altTop) return altTop.split(",")[0];
  return "";
}

async function ensureDownloadToken(encodedPath, token, authToken) {
  try {
    const r = await fetch(`${BASE}/${encodedPath}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: token } }),
    });
    if (!r.ok) return false;
    return true;
  } catch {
    return false;
  }
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function toMediaUrl(src) {
  const s = String(src || "");
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("gs://")) {
    const m = s.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!m) return s;
    const bucket = m[1];
    const objectPath = m[2];
    const encodedPath = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
  }
  return s;
}

export async function getDisplayPhotoUrl(src) {
  const mediaUrl = toMediaUrl(src);
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("data:") || mediaUrl.startsWith("blob:")) return mediaUrl;
  if (mediaUrl.includes("token=")) return mediaUrl;

  const cached = displayUrlCache.get(mediaUrl);
  if (cached) return cached;

  const { token } = getFirebaseSession();
  if (!token) return mediaUrl;

  try {
    const r = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return mediaUrl;
    const blob = await r.blob();
    const objUrl = URL.createObjectURL(blob);
    displayUrlCache.set(mediaUrl, objUrl);
    displayUrlOrder.push(mediaUrl);
    if (displayUrlOrder.length > 200) {
      const oldest = displayUrlOrder.shift();
      const oldUrl = oldest ? displayUrlCache.get(oldest) : null;
      if (oldest) displayUrlCache.delete(oldest);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
    }
    return objUrl;
  } catch {
    return mediaUrl;
  }
}

export async function uploadPhoto(base64, path) {
  if (!isStorageOk()) throw new Error("Firebase Storage não configurado");

  const { token } = getFirebaseSession();
  if (!token) throw new Error("Usuário não autenticado");

  // Converter data URL ou blob URL para Blob
  let blob;
  try {
    if (String(base64 || "").startsWith("blob:")) {
      blob = await fetch(String(base64)).then((r) => r.blob());
    } else if (String(base64 || "").startsWith("data:")) {
      blob = dataURLtoBlob(String(base64));
    } else {
      throw new Error("Base64 inválido");
    }
  } catch (e) {
    console.error("Erro ao converter base64:", e);
    throw new Error("Erro ao processar imagem");
  }

  const fullPath = `semcas/inventario/${path}`;
  const encodedPath = encodeURIComponent(fullPath);

  const uploadRes = await fetch(`${BASE}?uploadType=media&name=${encodedPath}`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "image/jpeg",
      Authorization: `Bearer ${token}`,
    },
    body: blob,
  });

  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw new Error(uploadJson?.error?.message || "Erro no upload da foto");
  }

  let downloadToken = pickDownloadToken(uploadJson);

  if (!downloadToken) {
    const nextToken = makeDownloadToken();
    const ok = await ensureDownloadToken(encodedPath, nextToken, token);
    if (ok) downloadToken = nextToken;
  }

  return downloadToken ? `${BASE}/${encodedPath}?alt=media&token=${downloadToken}` : `${BASE}/${encodedPath}?alt=media`;
}

export async function uploadPhotos(arr, prefix, onProgress) {
  if (!isStorageOk()) {
    console.warn("Firebase Storage não configurado");
    return [];
  }
  const urls = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      const fileName = `${prefix}_${Date.now()}_${i}.jpg`;
      const url = await uploadPhoto(arr[i], fileName);
      urls.push(url);
      onProgress?.(i + 1, arr.length);
    } catch (e) {
      console.error(`Erro ao fazer upload da foto ${i}:`, e);
      // Continua com as próximas fotos mesmo se uma falhar
    }
  }
  return urls;
}

export async function deletePhoto(downloadUrl) {
  try {
    const { token } = getFirebaseSession();
    if (!token) return;

    const s = String(downloadUrl || "");
    if (s.startsWith("gs://")) {
      const m = s.match(/^gs:\/\/([^/]+)\/(.+)$/);
      if (!m) return;
      const bucket = m[1];
      const objectPath = m[2];
      const encodedPath = encodeURIComponent(objectPath);
      await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      return;
    }

    const match = s.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return;
    const encodedPath = match[1];
    await fetch(`${BASE}/${encodedPath}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    console.error("Erro ao deletar foto:", e);
  }
}
