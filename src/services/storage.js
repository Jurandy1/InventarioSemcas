import { getFirebaseSession, isFirebaseConfigured } from "./firebase.js";

const BUCKET = import.meta.env.VITE_FB_STORAGE_BUCKET || "";
const BASE = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

export const isStorageOk = () => isFirebaseConfigured() && !!BUCKET;

export async function uploadPhoto(base64, path) {
  if (!isStorageOk()) throw new Error("Firebase Storage não configurado");

  const { token } = getFirebaseSession();
  if (!token) throw new Error("Usuário não autenticado");

  const res = await fetch(base64);
  const blob = await res.blob();

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

  const downloadToken =
    typeof uploadJson.downloadTokens === "string" && uploadJson.downloadTokens
      ? uploadJson.downloadTokens.split(",")[0]
      : "";

  const downloadUrl = downloadToken ? `${BASE}/${encodedPath}?alt=media&token=${downloadToken}` : `${BASE}/${encodedPath}?alt=media`;
  return downloadUrl;
}

export async function uploadPhotos(arr, prefix, onProgress) {
  const urls = [];
  for (let i = 0; i < arr.length; i++) {
    const fileName = `${prefix}_${Date.now()}_${i}.jpg`;
    const url = await uploadPhoto(arr[i], fileName);
    urls.push(url);
    onProgress?.(i + 1, arr.length);
  }
  return urls;
}

export async function deletePhoto(downloadUrl) {
  try {
    const { token } = getFirebaseSession();
    if (!token) return;

    const match = downloadUrl.match(/\/o\/(.+?)\?/);
    if (!match) return;

    await fetch(`${BASE}/${match[1]}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
}

