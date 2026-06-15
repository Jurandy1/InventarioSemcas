import { fsDel, fsGetAll, fsGetDoc, fsSet, fsSetStrict } from "./firebase.js";
import { isStorageOk, uploadPhotos } from "./storage.js";
import { compressPhotoArray } from "../utils/performance.js";
import { deleteOfflinePhotos, loadOfflinePhotos, saveOfflinePhotos } from "../utils/offlineStore.js";
import { createVisibilityAwarePoller, isLikelySlowDevice, isPageHidden } from "../utils/mobilePerf.js";

import { get, set } from "idb-keyval";

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

export async function gerarRelatorioPDF(unidadeId, unidades, found) {
  try {
    const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const jsPDF = mod.jsPDF || mod.default?.jsPDF;
    if (!jsPDF) throw new Error("Não foi possível carregar jsPDF");

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
        f?.situacao || "-",
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
