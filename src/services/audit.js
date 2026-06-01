import { fsGetAll, fsSet, getFirebaseSession } from "./firebase.js";

export async function logAuditoria(acao, entidade, entidadeId, antes = null, depois = null) {
  const { uid } = getFirebaseSession();

  const auditLog = {
    timestamp: new Date().toISOString(),
    userId: uid || "anonimo",
    acao,
    entidade,
    entidadeId,
    antes: antes ? JSON.stringify(antes) : null,
    depois: depois ? JSON.stringify(depois) : null,
    mudancas: computaDiferencas(antes, depois),
  };

  try {
    const logId = `${entidadeId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await fsSet("auditoria", logId, auditLog);
    return logId;
  } catch (e) {
    console.error("Erro ao registrar auditoria:", e);
    return null;
  }
}

function computaDiferencas(antes, depois) {
  if (!antes || !depois) return [];

  const diffs = [];
  const keys = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]);
  for (const chave of keys) {
    const valAnt = antes?.[chave];
    const valDep = depois?.[chave];
    if (JSON.stringify(valAnt) !== JSON.stringify(valDep)) {
      diffs.push({ campo: chave, antes: valAnt, depois: valDep });
    }
  }
  return diffs;
}

export async function obterHistorico(entidade, entidadeId) {
  try {
    const todosLogs = await fsGetAll("auditoria");
    return todosLogs
      .filter((log) => log.entidade === entidade && log.entidadeId === entidadeId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (e) {
    console.error("Erro ao obter historico:", e);
    return [];
  }
}

export async function criarBackupManual() {
  const { uid } = getFirebaseSession();
  if (!uid) throw new Error("Usuario nao autenticado");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupId = `backup_${timestamp}`;
  const backup = {
    criadoEm: new Date().toISOString(),
    criadoPor: uid,
    colecoes: {},
  };

  const colecoes = ["inventario", "locais", "manuais", "auditoria", "coordenadores"];
  for (const colecao of colecoes) {
    try {
      backup.colecoes[colecao] = await fsGetAll(colecao);
    } catch (e) {
      console.warn(`Erro ao fazer backup de ${colecao}:`, e);
      backup.colecoes[colecao] = [];
    }
  }

  await fsSet("backups", backupId, backup);
  return {
    id: backupId,
    timestamp,
    tamanho: JSON.stringify(backup).length,
  };
}

export function setupRealtimeSync(unidadeId, onInventarioChange, onLocaisChange, onCoordenadoresChange) {
  const { uid } = getFirebaseSession();
  if (!uid) return null;

  const unsubscribers = [];
  const opts = arguments.length > 4 && typeof arguments[4] === "object" ? arguments[4] : {};
  const invMs = Math.max(5000, Number(opts.inventarioMs || 30000) || 30000);
  const locaisMs = Math.max(10000, Number(opts.locaisMs || 60000) || 60000);
  const coordMs = Math.max(15000, Number(opts.coordenadoresMs || 90000) || 90000);

  const filterInventario = (docs) => {
    if (!unidadeId) return docs;
    return docs.filter((d) => !d.unidadeId || d.unidadeId === unidadeId);
  };

  if (onInventarioChange) {
    const fetchInventario = () =>
      unidadeId
        ? fsGetAll("inventario", { where: [{ field: "unidadeId", op: "EQUAL", value: unidadeId }], orderBy: ["__name__"] })
        : fsGetAll("inventario");

    fetchInventario().then((docs) => onInventarioChange(filterInventario(docs)));
    const interval = setInterval(async () => {
      const updated = await fetchInventario();
      onInventarioChange(filterInventario(updated));
    }, invMs);
    unsubscribers.push(() => clearInterval(interval));
  }

  if (onLocaisChange) {
    fsGetAll("locais").then((docs) => onLocaisChange(docs));
    const interval = setInterval(async () => {
      const updated = await fsGetAll("locais");
      onLocaisChange(updated);
    }, locaisMs);
    unsubscribers.push(() => clearInterval(interval));
  }

  if (onCoordenadoresChange) {
    fsGetAll("coordenadores").then((docs) => onCoordenadoresChange(docs));
    const interval = setInterval(async () => {
      const updated = await fsGetAll("coordenadores");
      onCoordenadoresChange(updated);
    }, coordMs);
    unsubscribers.push(() => clearInterval(interval));
  }

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
}

export const FIREBASE_SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth.token.role == 'admin';
    }

    match /inventario/{document=**} {
      allow read: if request.auth.token.unidadeId == resource.data.unidadeId;
      allow write: if request.auth.token.unidadeId == resource.data.unidadeId &&
                      request.auth.token.role == 'coordenadora';
    }

    match /locais/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'admin';
    }

    match /coordenadores/{uid} {
      allow read, write: if request.auth.uid == uid || request.auth.token.role == 'admin';
    }

    match /auditoria/{document=**} {
      allow read: if request.auth.token.role == 'admin';
      allow create: if request.auth != null;
      allow update, delete: if false;
    }

    match /backups/{document=**} {
      allow read, write: if request.auth.token.role == 'admin';
    }
  }
}
`;

export function getSecurityRulesInstructions() {
  return `
Para habilitar permissoes granulares:
1. Firebase Console > Firestore > Regras
2. Cole FIREBASE_SECURITY_RULES
3. Publique
  `.trim();
}

export async function verificarIntegridade() {
  const report = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    const todosItens = await fsGetAll("manuais");
    const nfMap = {};
    const duplicatas = [];
    for (const item of todosItens) {
      const nf = item.nf?.trim();
      if (!nf) continue;
      if (nfMap[nf]) {
        duplicatas.push({ nf, itens: [nfMap[nf].id, item.id] });
      } else {
        nfMap[nf] = item;
      }
    }
    report.checks.nfDuplicadas = {
      status: duplicatas.length === 0 ? "OK" : "FALHA",
      detalhes: duplicatas,
    };
  } catch (e) {
    report.checks.nfDuplicadas = { status: "ERRO", msg: e.message };
  }

  try {
    const todosItens = await fsGetAll("manuais");
    const valoresNegativos = todosItens.filter((i) => (i.valor || 0) < 0 || (i.valorAtual || 0) < 0);
    report.checks.valoresNegativos = {
      status: valoresNegativos.length === 0 ? "OK" : "FALHA",
      quantidade: valoresNegativos.length,
    };
  } catch (e) {
    report.checks.valoresNegativos = { status: "ERRO", msg: e.message };
  }

  try {
    const inventario = await fsGetAll("inventario");
    const manuais = await fsGetAll("manuais");
    const orfaos = inventario.filter((inv) => !manuais.find((m) => m.id === inv.patrimonioId));
    report.checks.referenciasOrfas = {
      status: orfaos.length === 0 ? "OK" : "AVISO",
      quantidade: orfaos.length,
    };
  } catch (e) {
    report.checks.referenciasOrfas = { status: "ERRO", msg: e.message };
  }

  return report;
}
