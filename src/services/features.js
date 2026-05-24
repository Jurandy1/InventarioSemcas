import { fsGetAll, fsSet } from "./firebase.js";

export class OfflineManager {
  constructor() {
    this.queue = [];
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.loadQueue();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.onOnline());
      window.addEventListener("offline", () => this.onOffline());
    }
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem("offline-queue");
      this.queue = stored ? JSON.parse(stored) : [];
    } catch {
      this.queue = [];
    }
  }

  persistQueue() {
    try {
      localStorage.setItem("offline-queue", JSON.stringify(this.queue));
    } catch {}
  }

  onOnline() {
    this.isOnline = true;
    this.syncQueue();
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
    };

    this.queue.push(op);
    this.persistQueue();

    if (this.isOnline) {
      return this.executeOperation(op);
    }
    return { queued: true, id: op.id };
  }

  async executeOperation(op) {
    try {
      switch (op.type) {
        case "save":
          await fsSet(op.data.collection, op.data.docId, op.data.content);
          break;
        case "approve":
          await fsSet("coordenadores", op.data.uid, op.data.coordData);
          break;
        default:
          break;
      }

      op.status = "synced";
      this.queue = this.queue.filter((o) => o.id !== op.id);
      this.persistQueue();
      return { success: true };
    } catch (e) {
      op.status = "failed";
      this.persistQueue();
      console.error("Erro ao sincronizar:", e);
      return { success: false, error: e.message };
    }
  }

  async syncQueue() {
    const pending = this.queue.filter((op) => op.status === "pending" || op.status === "failed");
    for (const op of pending) {
      await this.executeOperation(op);
    }
  }

  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((o) => o.status === "pending").length,
      failed: this.queue.filter((o) => o.status === "failed").length,
      isOnline: this.isOnline,
    };
  }
}

export const offlineManager = new OfflineManager();

export class NotificationService {
  constructor() {
    this.subscribers = {};
    this.history = [];
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
    if (this.history.length > 100) this.history.shift();

    const callbacks = this.subscribers[event] || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error("Erro em callback:", e);
      }
    });
  }

  getHistory() {
    return this.history;
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
  const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const jsPDF = mod.jsPDF || mod.default?.jsPDF;
  if (!jsPDF) throw new Error("Nao foi possivel carregar jsPDF");

  const unidade = unidades.find((u) => u.id === unidadeId);
  if (!unidade) throw new Error("Unidade nao encontrada");

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
}

export async function gerarRelatorioExcel(unidadeId, unidades, found) {
  const XLSX = await import("xlsx/xlsx.mjs");
  const unidade = unidades.find((u) => u.id === unidadeId);
  if (!unidade) throw new Error("Unidade nao encontrada");

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
