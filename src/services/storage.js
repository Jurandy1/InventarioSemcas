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

/**
 * Resolve uma URL de foto para exibição.
 * - URLs data:/blob: → retorna diretamente
 * - URLs com token= → retorna diretamente (já públicas)
 * - URLs Firebase sem token → busca com auth e cria blob URL
 * - forceRefresh=true → ignora cache e busca nova URL
 */
export async function getDisplayPhotoUrl(src, { forceRefresh = false } = {}) {
  const mediaUrl = toMediaUrl(src);
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("data:") || mediaUrl.startsWith("blob:")) return mediaUrl;
  if (mediaUrl.includes("token=")) return mediaUrl;

  if (!forceRefresh) {
    const cached = displayUrlCache.get(mediaUrl);
    if (cached) return cached;
  }

  const { token } = getFirebaseSession();
  if (!token) return mediaUrl;

  try {
    const r = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return mediaUrl;
    const blob = await r.blob();
    const objUrl = URL.createObjectURL(blob);

    // Revogar blob URL antigo do cache antes de substituir (forceRefresh)
    if (forceRefresh) {
      const oldUrl = displayUrlCache.get(mediaUrl);
      if (oldUrl && oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
    }

    displayUrlCache.set(mediaUrl, objUrl);
    if (!displayUrlOrder.includes(mediaUrl)) displayUrlOrder.push(mediaUrl);

    // Aumentado para 500 entradas para reduzir revogações prematuras de blob URLs em uso
    if (displayUrlOrder.length > 500) {
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

/**
 * Baixa a foto como Blob (com auth Firebase quando necessário).
 * Se o navegador bloquear CORS do Firebase Storage, usa /api/foto-proxy
 * (Vercel em produção; middleware Vite em dev/preview).
 *
 * Nota: o arquivo da foto fica no Firebase Storage. O Supabase só guarda
 * as URLs em inventario.foto_urls — não há Storage de imagens no Supabase.
 */
export async function fetchPhotoBlob(src) {
  const mediaUrl = toMediaUrl(src);
  if (!mediaUrl) return null;

  if (mediaUrl.startsWith("data:")) {
    try {
      return dataURLtoBlob(mediaUrl);
    } catch {
      return null;
    }
  }

  if (mediaUrl.startsWith("blob:")) {
    try {
      const r = await fetch(mediaUrl);
      if (!r.ok) return null;
      return await r.blob();
    } catch {
      return null;
    }
  }

  const { token } = getFirebaseSession();
  const tryFetch = async (url, headers) => {
    const r = await fetch(url, headers ? { headers } : undefined);
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob || blob.size === 0) return null;
    // Proxy JSON { mimeType, data } — não é imagem
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return null;
    return blob;
  };

  // 1) Auth direto no Firebase
  if (token) {
    try {
      const withAuth = await tryFetch(mediaUrl, { Authorization: `Bearer ${token}` });
      if (withAuth) return withAuth;
    } catch {}
  }

  // 2) Público (URL com download token)
  try {
    const pub = await tryFetch(mediaUrl, null);
    if (pub) return pub;
  } catch {}

  // 3) Cache de exibição (blob já resolvido)
  try {
    const display = await getDisplayPhotoUrl(mediaUrl);
    if (display && display.startsWith("blob:")) {
      const r = await fetch(display);
      if (r.ok) return await r.blob();
    }
    if (display && display.startsWith("data:")) {
      return dataURLtoBlob(display);
    }
  } catch {}

  // 4) Proxy servidor (evita CORS) — GET bytes
  try {
    const proxyUrl = `/api/foto-proxy?url=${encodeURIComponent(mediaUrl)}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const viaProxy = await tryFetch(proxyUrl, headers);
    if (viaProxy) return viaProxy;
  } catch {}

  // 5) Proxy POST → base64
  try {
    const r = await fetch("/api/foto-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url: mediaUrl }),
    });
    if (r.ok) {
      const json = await r.json();
      if (json?.data) {
        const mime = json.mimeType || "image/jpeg";
        return dataURLtoBlob(`data:${mime};base64,${json.data}`);
      }
    }
  } catch {}

  return null;
}

export async function uploadPhoto(base64, path) {
  if (!isStorageOk()) throw new Error("Firebase Storage não configurado");

  const { token } = getFirebaseSession();
  if (!token) throw new Error("Usuário não autenticado");

  // Converter base64 URL ou blob URL para Blob
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
    throw new Error("Erro no processamento da imagem");
  }

  const fullPath = `semcas/inventario/${String(path || "")}`;
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
