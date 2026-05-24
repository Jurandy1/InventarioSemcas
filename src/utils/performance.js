import { fsGetAll } from "../services/firebase.js";

export async function paginarItens(unidadeId, pageSize = 50, cursor = null) {
  try {
    const allItens = await fsGetAll("manuais");
    const itensUnidade = allItens
      .filter((item) => item.unidadeId === unidadeId)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    let startIdx = 0;
    if (cursor) {
      startIdx = itensUnidade.findIndex((i) => i.id === cursor) + 1;
      if (startIdx < 0) startIdx = 0;
    }

    const paged = itensUnidade.slice(startIdx, startIdx + pageSize);
    const nextCursor = paged.length === pageSize ? paged[paged.length - 1]?.id || null : null;
    const prevCursor = startIdx > 0 ? itensUnidade[Math.max(0, startIdx - pageSize)]?.id || null : null;

    return {
      itens: paged,
      nextCursor,
      prevCursor,
      total: itensUnidade.length,
      hasMore: nextCursor !== null,
    };
  } catch (e) {
    console.error("Erro ao paginar:", e);
    return { itens: [], nextCursor: null, prevCursor: null, total: 0, hasMore: false };
  }
}

const CACHE_PREFIX = "inv-cache-v2";
const CACHE_TTL = 30 * 60 * 1000;

export async function getCachedData(key) {
  try {
    const stored = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!stored) return null;

    const { data, ts } = JSON.parse(stored);
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
    localStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify({ data, ts: Date.now() }));
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

function compressPhotoWithTimeout(base64, maxWidth = 800, maxHeight = 600, quality = 0.65, timeoutMs = 5000) {
  return Promise.race([
    new Promise((resolve) => {
      const img = new Image();
      let resolved = false;

      img.onload = () => {
        if (resolved) return;
        resolved = true;

        try {
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
          resolve(canvas.toDataURL("image/jpeg", quality));
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
      batch.map((b) => compressPhoto(b, 800, 600, 0.65))
    );

    results.push(...batchResults);
    onProgress?.(Math.min(i + BATCH_SIZE, base64Array.length), base64Array.length);

    // Dar tempo para a UI responder
    await new Promise((r) => setTimeout(r, 100));
  }

  return results;
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
