import { fsQueryPage } from "../services/firebase.js";

export async function paginarItens(unidadeId, pageSize = 50, cursor = null) {
  try {
    const res = await fsQueryPage("manuais", {
      where: [{ field: "unidadeId", op: "EQUAL", value: unidadeId }],
      orderBy: [{ field: "id", direction: "ASCENDING" }],
      pageSize,
      cursor,
    });

    return {
      itens: res.docs,
      nextCursor: res.nextCursor,
      prevCursor: null,
      total: null,
      hasMore: Boolean(res.nextCursor),
    };
  } catch (e) {
    console.error("Erro ao paginar:", e);
    return { itens: [], nextCursor: null, prevCursor: null, total: 0, hasMore: false };
  }
}

const CACHE_PREFIX = "inv-cache-v2";
const CACHE_TTL = 30 * 60 * 1000;
const CACHE_BUSTER_KEY = `${CACHE_PREFIX}:__buster__`;

function getCacheBuster() {
  try {
    const raw = localStorage.getItem(CACHE_BUSTER_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function bumpCacheBuster() {
  try {
    localStorage.setItem(CACHE_BUSTER_KEY, String(Date.now()));
  } catch {}
}

export async function getCachedData(key) {
  try {
    const stored = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!stored) return null;

    const { data, ts, buster } = JSON.parse(stored);
    if (typeof buster === "number" && buster !== getCacheBuster()) {
      localStorage.removeItem(`${CACHE_PREFIX}:${key}`);
      return null;
    }
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_PREFIX}:${key}`);
      return null;
    }
    return data;
  } catch (e) {
    console.warn("Cache read error:", e);
    return null;
  }
}

export async function setCachedData(key, data) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify({ data, ts: Date.now(), buster: getCacheBuster() }));
  } catch (e) {
    console.warn("Cache write failed:", e);
  }
}

export async function clearCache(pattern = null) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CACHE_PREFIX) && (!pattern || key.includes(pattern))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error("Cache clear failed:", e);
  }
}

function estimateDataUrlBytes(dataUrl) {
  const s = String(dataUrl || "");
  const idx = s.indexOf(",");
  if (idx < 0) return 0;
  const b64 = s.slice(idx + 1);
  let padding = 0;
  if (b64.endsWith("==")) padding = 2;
  else if (b64.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function compressPhotoWithTimeout(
  base64,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.8,
  timeoutMs = 5000,
  targetBytes = 360 * 1024,
  minQuality = 0.6
) {
  return Promise.race([
    new Promise((resolve) => {
      const img = new Image();
      let resolved = false;

      img.onload = () => {
        if (resolved) return;
        resolved = true;

        try {
          if (estimateDataUrlBytes(base64) > 0 && estimateDataUrlBytes(base64) <= targetBytes && img.width <= maxWidth && img.height <= maxHeight) {
            resolve(base64);
            return;
          }

          let w = img.width;
          let h = img.height;

          if (w > maxWidth) {
            h *= maxWidth / w;
            w = maxWidth;
          }
          if (h > maxHeight) {
            w *= maxHeight / h;
            h = maxHeight;
          }

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w));
          canvas.height = Math.max(1, Math.round(h));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(base64);
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const clampQ = (q) => Math.min(0.92, Math.max(minQuality, q));
          let lo = minQuality;
          let hi = clampQ(quality);
          let best = "";

          let out = canvas.toDataURL("image/jpeg", hi);
          if (estimateDataUrlBytes(out) <= targetBytes) {
            resolve(out);
            return;
          }

          for (let i = 0; i < 6; i++) {
            const mid = clampQ((lo + hi) / 2);
            out = canvas.toDataURL("image/jpeg", mid);
            const bytes = estimateDataUrlBytes(out);
            if (bytes > targetBytes) {
              hi = mid;
            } else {
              lo = mid;
              best = out;
            }
          }

          resolve(best || out);
        } catch (err) {
          console.error("Erro ao comprimir:", err);
          resolve(base64);
        }
      };

      img.onerror = () => {
        if (resolved) return;
        resolved = true;
        console.warn("Erro ao carregar imagem");
        resolve(base64);
      };

      img.src = base64;
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`Timeout ao comprimir imagem (>${timeoutMs}ms)`);
        resolve(base64);
      }, timeoutMs);
    }),
  ]);
}

export async function compressPhoto(base64, maxWidth = 800, maxHeight = 600, quality = 0.65) {
  return compressPhotoWithTimeout(base64, maxWidth, maxHeight, quality, 5000);
}

export async function compressPhotoArray(base64Array, onProgress) {
  const results = [];
  const BATCH_SIZE = 2; // Processar 2 fotos por vez para evitar travamento

  for (let i = 0; i < base64Array.length; i += BATCH_SIZE) {
    const batch = base64Array.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((b) => compressPhotoWithTimeout(b, 1600, 1200, 0.82, 5000, 360 * 1024, 0.6))
    );

    results.push(...batchResults);
    onProgress?.(Math.min(i + BATCH_SIZE, base64Array.length), base64Array.length);

    // Dar tempo para a UI responder
    await new Promise((r) => setTimeout(r, 100));
  }

  return results;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(blob);
  });
}

export async function normalizePhotoSourcesToDataUrls(sources = []) {
  const out = [];
  for (const src of sources || []) {
    const s = String(src || "");
    if (!s) continue;
    if (s.startsWith("data:")) {
      out.push(s);
      continue;
    }
    if (s.startsWith("blob:")) {
      try {
        const b = await fetch(s).then((r) => r.blob());
        const d = await blobToDataUrl(b);
        if (d) out.push(d);
      } catch {}
      continue;
    }
  }
  return out;
}

export const FIRESTORE_INDEXES = [
  {
    collection: "inventario",
    fields: [
      { fieldPath: "unidadeId", order: "Ascending" },
      { fieldPath: "patrimonioId", order: "Ascending" },
    ],
    description: "Para buscar itens por unidade rapidamente",
  },
  {
    collection: "inventario",
    fields: [
      { fieldPath: "unidadeId", order: "Ascending" },
      { fieldPath: "estado", order: "Ascending" },
    ],
    description: "Para filtrar por estado por unidade",
  },
  {
    collection: "manuais",
    fields: [
      { fieldPath: "nf", order: "Ascending" },
      { fieldPath: "dataNF", order: "Descending" },
    ],
    description: "Para buscar por NF",
  },
];

export function getIndexCreationInstructions() {
  return `
Para melhorar performance, crie estes indices no Firestore:

${FIRESTORE_INDEXES.map((idx) => `- ${idx.collection}: ${idx.fields.map((f) => f.fieldPath).join(", ")} (${idx.description})`).join("\n")}
  `.trim();
}

export class PerformanceMonitor {
  constructor() {
    this.marks = {};
  }

  start(label) {
    this.marks[label] = performance.now();
  }

  end(label) {
    if (!this.marks[label]) return null;
    const duration = performance.now() - this.marks[label];
    delete this.marks[label];

    if (duration > 1000) {
      console.warn(`Performance: ${label} levou ${duration.toFixed(0)}ms`);
    } else if (duration > 500) {
      console.info(`Performance: ${label} levou ${duration.toFixed(0)}ms`);
    }

    return duration;
  }
}

export const perfMonitor = new PerformanceMonitor();
