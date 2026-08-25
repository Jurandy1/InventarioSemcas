import { fsDel, fsGetAll, fsGetDoc, fsSet, fsSetStrict } from "./firebase.js";
import { fetchPhotoBlob, isStorageOk, uploadPhotos } from "./storage.js";
import { compressPhoto, compressPhotoArray } from "../utils/performance.js";
import { deleteOfflinePhotos, loadOfflinePhotos, saveOfflinePhotos } from "../utils/offlineStore.js";
import { createVisibilityAwarePoller, isLikelySlowDevice, isPageHidden } from "../utils/mobilePerf.js";
import { getCategoryGroup } from "../constants/categories.js";
import { fetchLocaisForUnits } from "./locaisLoad.js";

import { get, set } from "idb-keyval";

async function blobToJpegDataUrl(blob, maxW = 420, maxH = 320, quality = 0.72) {
  if (!blob) return "";

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      let w = bitmap.width || 1;
      let h = bitmap.height || 1;
      if (w > maxW) {
        h = Math.max(1, Math.round((h * maxW) / w));
        w = maxW;
      }
      if (h > maxH) {
        w = Math.max(1, Math.round((w * maxH) / h));
        h = maxH;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close?.();
        return "";
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      return canvas.toDataURL("image/jpeg", quality);
    } catch (e) {
      console.warn("createImageBitmap falhou, tentando Image:", e);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || 1;
          let h = img.naturalHeight || img.height || 1;
          if (w > maxW) {
            h = Math.max(1, Math.round((h * maxW) / w));
            w = maxW;
          }
          if (h > maxH) {
            w = Math.max(1, Math.round((w * maxH) / h));
            h = maxH;
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function photoSrcToJpegDataUrl(src, maxW = 420, maxH = 320, quality = 0.72) {
  const raw = String(src || "");
  if (!raw) return "";
  try {
    if (raw.startsWith("data:image/jpeg") || raw.startsWith("data:image/jpg")) {
      return (await compressPhoto(raw, maxW, maxH, quality)) || raw;
    }
    if (raw.startsWith("data:")) {
      const compressed = await compressPhoto(raw, maxW, maxH, quality);
      if (compressed && compressed.startsWith("data:image/jpeg")) return compressed;
      const blob = await (await fetch(raw)).blob();
      return (await blobToJpegDataUrl(blob, maxW, maxH, quality)) || compressed || "";
    }

    const blob = await fetchPhotoBlob(raw);
    if (!blob) {
      console.warn("Foto indisponível: não foi possível baixar", String(raw).slice(0, 80));
      return "";
    }
    return await blobToJpegDataUrl(blob, maxW, maxH, quality);
  } catch (e) {
    console.warn("Erro ao preparar foto para PDF:", e);
    return "";
  }
}

export class OfflineManager {
  constructor() {
    this.queue = [];
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.syncInterval = null;
    this.syncIntervalCleanup = null;
    this.lastError = "";
    this.loadQueue();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.onOnline());
      window.addEventListener("offline", () => this.onOffline());
    }
    this.startPeriodicSync();
  }

  async loadQueue() {
    try {
      const stored = await get("offline-queue");
      this.queue = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Erro ao carregar fila offline:", e);
      this.queue = [];
    }
  }

  async persistQueue() {
    try {
      await set("offline-queue", JSON.stringify(this.queue));
    } catch (e) {
      console.error("Erro ao salvar fila offline:", e);
    }
  }

  startPeriodicSync() {
    this.stopPeriodicSync();
    const activeMs = isLikelySlowDevice() ? 20000 : 12000;
    const hiddenMs = 60000;
    const tick = () => {
      if (this.isOnline && !this.isSyncing && !isPageHidden()) {
        this.syncQueue().catch((e) => console.error("Erro na sincronização periódica:", e));
      }
    };
    this.syncIntervalCleanup = createVisibilityAwarePoller(tick, {
      activeMs,
      hiddenMs,
      runImmediately: false,
    });
  }

  stopPeriodicSync() {
    if (this.syncIntervalCleanup) {
      this.syncIntervalCleanup();
      this.syncIntervalCleanup = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  onOnline() {
    this.isOnline = true;
    this.syncQueue().catch((e) => console.error("Erro ao sincronizar online:", e));
  }

  onOffline() {
    this.isOnline = false;
  }

  async queueOperation(type, data) {
    const op = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      status: "pending",
      retries: 0,
    };

    this.queue.push(op);
    this.persistQueue();

    if (this.isOnline) {
      return this.executeOperation(op);
    }
    return { queued: true, id: op.id };
  }

  async uploadOfflinePhotos(photoOpId, uploadPrefix, existingUrls = []) {
    if (!photoOpId) return existingUrls;
    const pending = await loadOfflinePhotos(photoOpId);
    let urls = [...(existingUrls || [])];
    if (pending.length > 0 && isStorageOk()) {
      const compressed = await compressPhotoArray(pending);
      const uploaded = await uploadPhotos(compressed, uploadPrefix || photoOpId);
      urls = [...urls, ...uploaded];
    }
    await deleteOfflinePhotos(photoOpId);
    return urls;
  }

  async executeOperation(op) {
    try {
      switch (op.type) {
        case "save": {
          let content = { ...(op.data.content || {}) };
          if (op.data.photoOpId) {
            content.fotoUrls = await this.uploadOfflinePhotos(
              op.data.photoOpId,
              content.patrimonioId || op.data.docId,
              content.fotoUrls || []
            );
          }
          if (op.data.collection === "inventario" && this.isOnline) {
            try {
              const server = await fsGetDoc(op.data.collection, op.data.docId);
              const sinceTs = op.data.serverSinceTs || op.data.content?.ultimaAtualizacao;
              if (server?.ultimaAtualizacao && sinceTs) {
                const serverMs = new Date(server.ultimaAtualizacao).getTime();
                const sinceMs = new Date(sinceTs).getTime();
                if (serverMs > sinceMs) {
                  op.status = "discarded";
                  this.queue = this.queue.filter((o) => o.id !== op.id);
                  this.persistQueue();
                  notificationService.notify(EVENTOS.ITEM_ENCONTRADO, {
                    message: "Alteração local descartada — item já atualizado por outro usuário",
                    type: "warning",
                  });
                  return { success: false, discarded: true };
                }
              }
            } catch {}
          }
          await fsSetStrict(op.data.collection, op.data.docId, content);
          break;
        }
        case "delete":
          await fsDel(op.data.collection, op.data.docId);
          break;
        case "batch": {
          let sharedUrls = [];
          if (op.data.photoOpId) {
            sharedUrls = await this.uploadOfflinePhotos(
              op.data.photoOpId,
              op.data.uploadPrefix || op.data.steps?.[0]?.docId || "batch"
            );
          }
          for (const step of op.data.steps || []) {
            let content = { ...(step.content || {}) };
            if (step.usePhotos && sharedUrls.length) {
              content.fotoUrls = [...(content.fotoUrls || []), ...sharedUrls];
            }
            await fsSetStrict(step.collection, step.docId, content);
          }
          break;
        }
        case "approve":
          await fsSetStrict("coordenadores", op.data.uid, op.data.coordData);
          break;
        default:
          throw new Error(`Tipo de operação desconhecido: ${op.type}`);
      }

      op.status = "synced";
      this.lastError = "";
      this.queue = this.queue.filter((o) => o.id !== op.id);
      this.persistQueue();
      return { success: true };
    } catch (e) {
      this.lastError = e?.message || String(e);
      op.retries = (op.retries || 0) + 1;
      op.lastError = this.lastError;
      if (op.retries >= 5) {
        op.status = "failed";
        console.error(`Operação ${op.id} falhou após 5 tentativas:`, e);
      } else {
        op.status = "pending";
      }
      this.persistQueue();
      return { success: false, error: this.lastError, retries: op.retries };
    }
  }

  async syncQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pending = this.queue.filter((op) => op.status === "pending" || (op.status === "failed" && (op.retries || 0) < 5));
      for (const op of pending) {
        if (!this.isOnline) break; // Parar se desconectar
        await this.executeOperation(op);
        await new Promise((r) => setTimeout(r, 500)); // Aguardar 500ms entre operações
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async retrySync() {
    for (const op of this.queue) {
      if (op.status === "failed") {
        op.status = "pending";
        op.retries = 0;
      }
    }
    this.persistQueue();
    this.lastError = "";
    return this.syncQueue();
  }

  getQueueStatus() {
    const photoPending = this.queue.filter((o) => o.data?.photoOpId && (o.status === "pending" || o.status === "failed")).length;
    const failedOps = this.queue.filter((o) => o.status === "failed");
    return {
      total: this.queue.length,
      pending: this.queue.filter((o) => o.status === "pending").length,
      failed: failedOps.length,
      photoPending,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastError: this.lastError || failedOps[failedOps.length - 1]?.lastError || "",
    };
  }

  destroy() {
    this.stopPeriodicSync();
  }
}

export const offlineManager = new OfflineManager();

// Cleanup ao descarregar a página
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    offlineManager.persistQueue();
  });
}

export class NotificationService {
  constructor() {
    this.subscribers = {};
    this.history = [];
    this.maxHistory = 100;
  }

  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);
    return () => {
      this.subscribers[event] = this.subscribers[event].filter((cb) => cb !== callback);
    };
  }

  notify(event, data) {
    const notification = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.history.push(notification);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const callbacks = this.subscribers[event] || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error("Erro em callback de notificação:", e);
      }
    });
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
  }
}

export const notificationService = new NotificationService();

export const EVENTOS = {
  ITEM_ENCONTRADO: "item_encontrado",
  UNIDADE_COMPLETA: "unidade_completa",
  COORDENADORA_APROVADA: "coordenadora_aprovada",
  ERRO_SYNC: "erro_sync",
  BACKUP_CRIADO: "backup_criado",
  AUDITORIA_ANOMALIA: "auditoria_anomalia",
};

async function loadJsPDF() {
  const mod = await import("jspdf");
  const jsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default;
  if (!jsPDF) throw new Error("Não foi possível carregar jsPDF");
  return jsPDF;
}

export async function gerarRelatorioPDF(unidadeId, unidades, found) {
  try {
    const jsPDF = await loadJsPDF();

    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!unidade) throw new Error("Unidade não encontrada");

    const doc = new jsPDF();
    let y = 20;
    const pendentesItens = unidade.itens.filter((i) => !found.some((f) => f.patrimonioId === i.id));
    const inventariados = unidade.itens.length - pendentesItens.length;
    const progresso = unidade.itens.length > 0 ? Math.round((inventariados / unidade.itens.length) * 100) : 0;

    doc.setFontSize(18);
    doc.text("Relatorio de Inventario", 14, y);
    y += 10;
    doc.setFontSize(11);
    doc.text(`Unidade: ${unidade.nome}`, 14, y);
    y += 7;
    doc.text(`Data: ${new Date().toLocaleString("pt-BR")}`, 14, y);
    y += 7;
    doc.text(`Total: ${unidade.itens.length}`, 14, y);
    y += 7;
    doc.text(`Inventariados: ${inventariados}`, 14, y);
    y += 7;
    doc.text(`Pendentes: ${pendentesItens.length}`, 14, y);
    y += 7;
    doc.text(`Progresso: ${progresso}%`, 14, y);
    y += 12;
    doc.setFontSize(12);
    doc.text("Pendentes (primeiros 25)", 14, y);
    y += 8;
    doc.setFontSize(10);

    for (const item of pendentesItens.slice(0, 25)) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const label = `${item.id} - ${item.descricao || item.especie || "Sem descricao"}`;
      doc.text(label.slice(0, 100), 14, y);
      y += 6;
    }

    return doc;
  } catch (e) {
    console.error("Erro ao gerar PDF:", e);
    throw e;
  }
}

/**
 * PDF com fotos dos itens inventariados nas categorias escolhidas.
 * @param {object} opts
 * @param {Array} opts.itens - itens do catálogo (com unidadeNome/unidadeId)
 * @param {object} opts.foundMap - mapa patrimonioId → registro inventário
 * @param {string[]} opts.categorias - nomes de CATEGORY_TREE (vazio = todas)
 * @param {boolean} [opts.somenteComFoto=true]
 * @param {string[]} [opts.itemIds] - se informado, só estes patrimônios entram no PDF
 * @param {Array} [opts.locais] - lista de locais {id,nome} para resolver nomes
 * @param {(p:{done:number,total:number,label?:string})=>void} [opts.onProgress]
 */
export async function gerarRelatorioFotosCategorias({
  itens = [],
  foundMap = {},
  categorias = [],
  itemIds = null,
  somenteComFoto = true,
  locais = [],
  onProgress,
} = {}) {
  const jsPDF = await loadJsPDF();

  const catSet = categorias.length ? new Set(categorias) : null;
  const idSet = Array.isArray(itemIds) && itemIds.length > 0 ? new Set(itemIds.map(String)) : null;
  const rows = [];
  for (const item of itens) {
    const f = foundMap[item.id];
    if (!f) continue;
    if (idSet && !idSet.has(String(item.id))) continue;
    const cat = getCategoryGroup(f.especieEdit || item.especie);
    if (!idSet && catSet && !catSet.has(cat)) continue;
    const fotos = Array.isArray(f.fotoUrls) ? f.fotoUrls.filter(Boolean) : [];
    if (somenteComFoto && fotos.length === 0) continue;
    const unidade =
      (f.unidadeNome || item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "") || "—";
    rows.push({
      item,
      f,
      cat,
      fotos,
      desc: f.descricaoEdit || item.descricao || item.especie || "—",
      codigo: item.patrimonioLabel || item.id || "—",
      unidade,
      localId: f.localId || "",
      unidadeId: f.unidadeId || item.unidadeId || "",
    });
  }

  rows.sort((a, b) => {
    const c = String(a.cat).localeCompare(String(b.cat), "pt-BR");
    if (c !== 0) return c;
    const u = String(a.unidade).localeCompare(String(b.unidade), "pt-BR");
    if (u !== 0) return u;
    return String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true });
  });

  if (rows.length === 0) {
    throw new Error(
      somenteComFoto
        ? "Nenhum item inventariado com foto nas categorias selecionadas."
        : "Nenhum item inventariado nas categorias selecionadas."
    );
  }

  const localMap = new Map();
  for (const l of locais || []) {
    const id = l?.id || l?._id;
    if (id) localMap.set(id, l.nome || id);
  }
  const missingLocalIds = [
    ...new Set(rows.map((r) => r.localId).filter((id) => id && id !== "sem-local" && !localMap.has(id))),
  ];
  if (missingLocalIds.length) {
    try {
      const unitIds = [...new Set(rows.map((r) => r.unidadeId).filter(Boolean))];
      const fetched = await fetchLocaisForUnits(unitIds, { localIds: missingLocalIds });
      for (const l of fetched || []) {
        const id = l?.id || l?._id;
        if (id && l.nome) localMap.set(id, l.nome);
      }
    } catch {}
  }

  const resolveLocal = (localId) => {
    if (!localId || localId === "sem-local") return "Sem local";
    return localMap.get(localId) || localId;
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const catsLabel = catSet ? [...catSet].join(", ") : "Todas";
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Relatorio fotografico por categoria", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Categorias: ${catsLabel}`, margin, y);
  y += 5;
  doc.text(`Data: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 5;
  doc.text(`Itens: ${rows.length}${somenteComFoto ? " (somente com foto)" : ""}`, margin, y);
  y += 10;

  const photoH = 42;
  const photoW = 56;
  const gap = 4;
  const maxFotos = 2;
  const blockH = 24 + photoH + 4;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const localNome = resolveLocal(row.localId);
    onProgress?.({ done: i, total: rows.length, label: row.codigo });
    ensureSpace(blockH);

    doc.setDrawColor(220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 2, usableW, blockH - 2, 2, 2, "FD");

    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text(`Nº ${row.codigo}`, margin + 3, y + 4);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(row.cat, margin + usableW - 3, y + 4, { align: "right" });
    doc.setTextColor(0);

    const descLines = doc.splitTextToSize(String(row.desc).slice(0, 140), usableW - 6);
    doc.setFontSize(9);
    doc.text(descLines.slice(0, 1), margin + 3, y + 9);

    doc.setFontSize(8);
    doc.setTextColor(30);
    doc.setFont(undefined, "bold");
    const unidadeLine = `Unidade: ${String(row.unidade).slice(0, 70)}`;
    doc.text(unidadeLine, margin + 3, y + 14);
    doc.setFont(undefined, "normal");
    const localLine = `Local: ${String(localNome).slice(0, 70)}`;
    doc.text(localLine, margin + 3, y + 18.5);

    const meta = [row.f.estado ? `Estado: ${row.f.estado}` : "", row.f.situacao ? `Sit.: ${row.f.situacao}` : ""]
      .filter(Boolean)
      .join("  ·  ");
    if (meta) {
      doc.setFontSize(7.5);
      doc.setTextColor(80);
      doc.text(meta.slice(0, 110), margin + 3, y + 22.5);
      doc.setTextColor(0);
    } else {
      doc.setTextColor(0);
    }

    const fotosToLoad = row.fotos.slice(0, maxFotos);
    let x = margin + 3;
    const imgY = y + 24;
    for (const src of fotosToLoad) {
      const dataUrl = await photoSrcToJpegDataUrl(src);
      if (dataUrl && dataUrl.startsWith("data:image")) {
        try {
          const fmt = /data:image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, x, imgY, photoW, photoH);
        } catch (e) {
          console.warn("addImage falhou:", e);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("Foto indisponivel", x + 2, imgY + photoH / 2);
          doc.setTextColor(0);
        }
      } else {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Foto indisponivel", x + 2, imgY + photoH / 2);
        doc.setTextColor(0);
      }
      x += photoW + gap;
    }
    if (fotosToLoad.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Sem foto", margin + 3, imgY + photoH / 2);
      doc.setTextColor(0);
    }

    y += blockH;
  }

  onProgress?.({ done: rows.length, total: rows.length, label: "Concluído" });
  return doc;
}

export async function gerarRelatorioExcelCoord(itens, foundMap, unidadeNome = "") {
  try {
    const XLSX = await import("xlsx/xlsx.mjs");
    const worksheetData = [
      ["RELATORIO DE INVENTARIO - COORDENADORA"],
      [`Unidade(s): ${unidadeNome}`],
      [`Data: ${new Date().toLocaleDateString("pt-BR")}`],
      [],
      [
        "N Patrimonio",
        "Descricao",
        "Especie",
        "Status",
        "Estado",
        "Situacao",
        "Local",
        "Obs",
        "Inv. Usuario",
        "Inv. Data",
        "Inv. Fotos",
        "Coord. Estado",
        "Coord. Obs",
      ],
    ];

    for (const item of itens) {
      const f = foundMap[item.id];
      const ev = f?.registroInventariante;
      worksheetData.push([
        item.id,
        item.descricao || "",
        item.especie || "",
        f ? "Localizado" : "Pendente",
        f?.estado || "-",
        f?.situacao === "Permuta" ? "Em uso" : f?.situacao || "-",
        f?.localId || "",
        f?.obs || "",
        ev?.usuario || f?.usuario || "",
        ev?.data ? `${ev.data} ${ev.hora || ""}`.trim() : "",
        (ev?.fotoUrls || f?.fotoUrls || []).length,
        f?.coordenadora ? f.estado : "",
        f?.coordenadora ? f.obs : "",
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    return { workbook, XLSX };
  } catch (e) {
    console.error("Erro ao gerar Excel coord:", e);
    throw e;
  }
}

export async function queueOfflineWithPhotos({ type, data, photos, uploadPrefix }) {
  let photoOpId = data?.photoOpId || null;
  if (photos?.length && !photoOpId) {
    photoOpId = `ph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveOfflinePhotos(photoOpId, photos);
  }
  return offlineManager.queueOperation(type, { ...data, photoOpId, uploadPrefix });
}

export async function gerarRelatorioExcel(unidadeId, unidades, found) {
  try {
    const XLSX = await import("xlsx/xlsx.mjs");
    const unidade = unidades.find((u) => u.id === unidadeId);
    if (!unidade) throw new Error("Unidade não encontrada");

    const worksheetData = [
      ["RELATORIO DE INVENTARIO"],
      [`Unidade: ${unidade.nome}`],
      [`Data: ${new Date().toLocaleDateString("pt-BR")}`],
      [],
      ["N Patrimonio", "Descricao", "Especie", "Marca", "Fornecedor", "Valor", "Status", "Estado", "Observacoes"],
    ];

    for (const item of unidade.itens) {
      const foundItem = found.find((f) => f.patrimonioId === item.id);
      worksheetData.push([
        item.id,
        item.descricao || "",
        item.especie || "",
        item.marca || "",
        item.fornecedor || "",
        item.valor || 0,
        foundItem ? "Encontrado" : "Pendente",
        foundItem?.estado || "-",
        foundItem?.obs || "",
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    return { workbook, XLSX };
  } catch (e) {
    console.error("Erro ao gerar Excel:", e);
    throw e;
  }
}

export async function enviarParaAprovacao(itemId, coordenadoras) {
  const status = "pendente_aprovacao";
  await fsSet("inventario", itemId, {
    status,
    dataPendencia: new Date().toISOString(),
    emailsAprovadores: coordenadoras.map((c) => c.email),
  });
  return { status, id: itemId };
}

export async function aprovarItem(itemId, approverId, observacoes = "") {
  const approval = {
    itemId,
    approverId,
    status: "aprovado",
    dataAprovacao: new Date().toISOString(),
    observacoes,
  };
  await fsSet("aprovacoes", `${itemId}_${approverId}`, approval);
  return approval;
}

export async function rejeitarItem(itemId, approverId, motivo = "") {
  const rejection = {
    itemId,
    approverId,
    status: "rejeitado",
    dataRejeicao: new Date().toISOString(),
    motivo,
  };
  await fsSet("rejeicoes", `${itemId}_${approverId}`, rejection);
  return rejection;
}

export async function obterStatusAprovacao(itemId) {
  try {
    const aprovacoes = await fsGetAll("aprovacoes");
    const rejeicoes = await fsGetAll("rejeicoes");
    const aprovados = aprovacoes.filter((a) => a.itemId === itemId);
    const rejeitados = rejeicoes.filter((r) => r.itemId === itemId);
    const total = aprovados.length + rejeitados.length;

    return {
      itemId,
      totalAprovadores: total || 1,
      aprovados: aprovados.length,
      rejeitados: rejeitados.length,
      percentualAprovacao: total > 0 ? Math.round((aprovados.length / total) * 100) : 0,
    };
  } catch (e) {
    console.error("Erro ao obter status:", e);
    return null;
  }
}

export async function enviarWebhook(event, data) {
  const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "";
  if (!WEBHOOK_URL) return;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    });
  } catch (e) {
    console.error("Erro ao enviar webhook:", e);
  }
}

export async function sincronizarComERP(unidadeId) {
  const items = await fsGetAll("manuais");
  const unidadeItems = items.filter((i) => i.unidadeId === unidadeId);
  const payload = {
    unidadeId,
    timestamp: new Date().toISOString(),
    itens: unidadeItems.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      valor: i.valor,
      marca: i.marca,
    })),
  };

  await enviarWebhook("inventario.sync", payload);
  return payload;
}
