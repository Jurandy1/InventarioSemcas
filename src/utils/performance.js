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
  } catch {
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

export async function compressPhoto(base64, maxWidth = 800, maxHeight = 600, quality = 0.65) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
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
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

export async function compressPhotoArray(base64Array, onProgress) {
  const results = [];
  for (let i = 0; i < base64Array.length; i++) {
    const compressed = await compressPhoto(base64Array[i], 800, 600, 0.65);
    results.push(compressed);
    onProgress?.(i + 1, base64Array.length);
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
