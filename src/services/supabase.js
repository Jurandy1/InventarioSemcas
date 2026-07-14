import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let authClient = null;
/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let publicClient = null;
let accessToken = null;

// Colunas reais de cada tabela (schema + upgrade). Qualquer campo fora da lista
// vai para a coluna de overflow (extras/dados) em vez de gerar erro PGRST204.
const COL = {
  inventario: {
    table: "inventario",
    pk: "patrimonio_id",
    overflow: "extras",
    columns: [
      "patrimonio_id", "unidade_id", "unidade_nome", "estado", "situacao", "local_id",
      "obs", "marca", "origem", "foto_urls", "data", "hora", "usuario", "email",
      "ultima_atualizacao", "is_manual", "descricao_edit", "especie_edit", "imei",
      "sem_tombo", "tombo_referencia", "permuta_desc", "permuta_marca", "permuta_estado",
      "identificado_por_foto", "extras",
    ],
  },
  manuais: {
    table: "manuais",
    pk: "id",
    overflow: "extras",
    columns: [
      "id", "unidade_id", "patrimonio_label", "data", "especie", "descricao", "marca",
      "fornecedor", "empenho", "nf", "data_nf", "tipo_entrada", "valor", "valor_atual",
      "imei", "extras",
    ],
  },
  locais: {
    table: "locais",
    pk: "id",
    overflow: "extras",
    columns: ["id", "nome", "unidade_id", "unidade_ids", "criado_por", "criado_em", "desc", "session_id", "extras"],
  },
  inventariantes: {
    table: "inventariantes",
    pk: "uid",
    overflow: "extras",
    columns: [
      "uid", "email", "nome", "matricula", "cargo", "unidade_id", "unidade_ids",
      "unidade_nome", "unidade_nomes", "status", "criado_em", "data_criacao",
      "convite_token", "data_aprovacao", "observacoes", "aprovado_por", "data_rejeicao",
      "motivo_rejeicao", "rejeitado_por", "data_desativacao", "motivo_desativacao",
      "desativado_por", "extras",
    ],
  },
  coordenadores: {
    table: "coordenadores",
    pk: "uid",
    overflow: "extras",
    columns: [
      "uid", "email", "nome", "matricula", "unidade_id", "unidade_ids",
      "unidade_nome", "unidade_nomes", "status", "criado_em", "data_criacao",
      "convite_token", "data_aprovacao", "observacoes", "aprovado_por", "data_rejeicao",
      "motivo_rejeicao", "rejeitada_por", "data_desativacao", "motivo_desativacao",
      "desativada_por", "extras",
    ],
  },
  tombosNE: {
    table: "tombos_ne",
    pk: "id",
    overflow: "extras",
    columns: ["id", "unidade_id", "descricao", "obs", "usuario", "data", "extras"],
  },
  finalizacoes: {
    table: "finalizacoes",
    pk: "id",
    overflow: "extras",
    columns: [
      "id", "campanha_id", "unidade_ids", "unidade_nomes", "session_id", "finalized_at",
      "finalized_by", "coordenadora", "convite_token", "stats", "status", "ultima_edicao",
      "extras",
    ],
  },
  campanhas: { table: "campanhas", pk: "id", overflow: "dados", columns: ["id", "status", "dados"] },
  auditoria: {
    table: "auditoria",
    pk: "id",
    overflow: "dados",
    columns: ["id", "acao", "colecao", "doc_id", "usuario", "uid", "dados", "criado_em"],
  },
  convites: {
    table: "convites",
    pk: "id",
    overflow: "extras",
    columns: [
      "id", "token", "status", "criado_por", "data_criacao", "data_expiracao", "usado_por",
      "unidade_id", "unidade_nome", "matricula", "data_uso", "extras",
    ],
  },
  convites_inventariantes: {
    table: "convites_inventariantes",
    pk: "id",
    overflow: "extras",
    columns: [
      "id", "token", "status", "criado_por", "data_criacao", "data_expiracao", "usado_por",
      "unidade_id", "unidade_nome", "extras",
    ],
  },
  cadastro_indice: {
    table: "cadastro_indice",
    pk: "id",
    overflow: "extras",
    columns: ["id", "uid", "email", "matricula", "nome", "status", "papel", "chave", "atualizado_em", "extras"],
  },
  presenca_inventario: {
    table: "presenca_inventario",
    pk: "uid",
    overflow: "extras",
    columns: ["uid", "nome", "email", "unidade_ids", "item_em_edicao", "item_descricao", "atualizado_em", "ultimo_ping", "extras"],
  },
  aprovacoes: { table: "aprovacoes", pk: "id", overflow: "dados", columns: ["id", "item_id", "approver_id", "dados"] },
  rejeicoes: { table: "rejeicoes", pk: "id", overflow: "dados", columns: ["id", "item_id", "approver_id", "dados"] },
  backups: { table: "backups", pk: "id", overflow: "dados", columns: ["id", "criado_em", "criado_por", "dados"] },
};

// Colunas TIMESTAMPTZ: string vazia vira null para não quebrar o insert.
const TIMESTAMP_COLS = new Set([
  "inventario.ultima_atualizacao",
  "locais.criado_em",
  "inventariantes.criado_em",
  "coordenadores.criado_em",
  "finalizacoes.finalized_at",
  "finalizacoes.ultima_edicao",
  "auditoria.criado_em",
  "presenca_inventario.atualizado_em",
  "backups.criado_em",
]);

const CAMEL_OVERRIDES = {
  patrimonioId: "patrimonio_id",
  unidadeId: "unidade_id",
  unidadeIds: "unidade_ids",
  unidadeNome: "unidade_nome",
  unidadeNomes: "unidade_nomes",
  localId: "local_id",
  fotoUrls: "foto_urls",
  ultimaAtualizacao: "ultima_atualizacao",
  isManual: "is_manual",
  descricaoEdit: "descricao_edit",
  especieEdit: "especie_edit",
  semTombo: "sem_tombo",
  tomboRef: "tombo_referencia",
  tomboReferencia: "tombo_referencia",
  permutaDesc: "permuta_desc",
  permutaMarca: "permuta_marca",
  permutaEstado: "permuta_estado",
  identificadoPorFoto: "identificado_por_foto",
  patrimonioLabel: "patrimonio_label",
  dataNF: "data_nf",
  dataNf: "data_nf",
  tipoEntrada: "tipo_entrada",
  valorAtual: "valor_atual",
  campanhaId: "campanha_id",
  sessionId: "session_id",
  finalizedAt: "finalized_at",
  finalizedBy: "finalized_by",
  conviteToken: "convite_token",
  ultimaEdicao: "ultima_edicao",
  dataCriacao: "data_criacao",
  dataExpiracao: "data_expiracao",
  criadoPor: "criado_por",
  criadoEm: "criado_em",
  usadoPor: "usado_por",
  itemEmEdicao: "item_em_edicao",
  itemDescricao: "item_descricao",
  atualizadoEm: "atualizado_em",
  itemId: "item_id",
  approverId: "approver_id",
  userId: "uid",
  entidadeId: "doc_id",
  entidade: "colecao",
};

// Mapa reverso snake→camel. Construído com "primeiro vence" e correções manuais
// para chaves ambíguas (ex.: uid NÃO pode virar userId — quebrava aprovação de
// coordenadoras/inventariantes, que dependem de row.uid).
const SNAKE_OVERRIDES = {};
for (const [camel, snake] of Object.entries(CAMEL_OVERRIDES)) {
  if (!(snake in SNAKE_OVERRIDES)) SNAKE_OVERRIDES[snake] = camel;
}
SNAKE_OVERRIDES.uid = "uid";
SNAKE_OVERRIDES.doc_id = "docId";
SNAKE_OVERRIDES.colecao = "colecao";
SNAKE_OVERRIDES.tombo_referencia = "tomboReferencia";
SNAKE_OVERRIDES.data_nf = "dataNF";

export function isSupabaseConfigured() {
  return Boolean(URL && ANON);
}

export function setSupabaseAccessToken(token) {
  accessToken = token || null;
  authClient = null;
}

export function clearSupabaseAccessToken() {
  accessToken = null;
  authClient = null;
}

function getAuthClient() {
  if (!isSupabaseConfigured()) return null;
  if (!authClient) {
    authClient = createClient(URL, ANON, {
      accessToken: async () => accessToken,
    });
  }
  return authClient;
}

function getPublicClient() {
  if (!isSupabaseConfigured()) return null;
  if (!publicClient) publicClient = createClient(URL, ANON);
  return publicClient;
}

function cfg(collection) {
  return COL[String(collection || "").trim()] || null;
}

function toSnake(key) {
  if (CAMEL_OVERRIDES[key]) return CAMEL_OVERRIDES[key];
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function toCamel(key) {
  if (SNAKE_OVERRIDES[key]) return SNAKE_OVERRIDES[key];
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mergeExtras(row, extrasKey = "extras") {
  const base = { ...(row || {}) };
  const extras = base[extrasKey];
  if (extras && typeof extras === "object" && !Array.isArray(extras)) {
    delete base[extrasKey];
    for (const [k, v] of Object.entries(extras)) {
      const camel = toCamel(k);
      if (base[k] === undefined && base[camel] === undefined) base[camel] = v;
    }
  }
  const dados = base.dados;
  if (dados && typeof dados === "object" && !Array.isArray(dados)) {
    delete base.dados;
    for (const [k, v] of Object.entries(dados)) {
      if (base[k] === undefined) base[k] = v;
    }
  }
  return base;
}

function fromRow(collection, row) {
  if (!row) return null;
  const c = cfg(collection);
  const merged = mergeExtras({ ...row });
  const out = {};
  for (const [k, v] of Object.entries(merged)) {
    if (k === "dados" || k === "extras") continue;
    out[toCamel(k)] = v;
  }
  const id = c ? merged[c.pk] : merged.id;
  if (id != null) out._id = id;
  if (collection === "inventario" && id != null && !out.patrimonioId) out.patrimonioId = id;
  if (c?.pk === "uid" && id != null && !out.uid) out.uid = id;
  if (c?.pk === "id" && id != null && out.id === undefined) out.id = id;
  if (collection === "auditoria") {
    if (!out.timestamp && merged.criado_em) out.timestamp = merged.criado_em;
    if (!out.userId && merged.uid) out.userId = merged.uid;
    if (!out.entidadeId && merged.doc_id) out.entidadeId = merged.doc_id;
    if (!out.entidade && merged.colecao) out.entidade = merged.colecao;
  }
  if (collection === "campanhas" && merged.dados && typeof merged.dados === "object") {
    Object.assign(out, merged.dados);
  }
  return out;
}

function toRow(collection, docId, data) {
  const c = cfg(collection);
  const cols = new Set(c?.columns || []);
  const overflowKey = c?.overflow || null;

  const row = {};
  const overflow = {};

  for (const [k, v] of Object.entries(data || {})) {
    if (k === "_id" || v === undefined) continue;
    const snake = toSnake(k);
    if (c && snake === c.pk) continue; // pk vem de docId, abaixo
    if (
      collection === "auditoria" &&
      ["timestamp", "userId", "entidade", "entidadeId", "antes", "depois", "mudancas"].includes(k)
    ) {
      continue;
    }
    if (k === "extras" && v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(overflow, v);
      continue;
    }
    if (!cols.size || cols.has(snake)) {
      row[snake] = v === "" && c && TIMESTAMP_COLS.has(`${c.table}.${snake}`) ? null : v;
    } else {
      // Campo sem coluna própria: preserva no JSONB de overflow (extras/dados)
      overflow[k] = v;
    }
  }

  if (c) row[c.pk] = docId;

  if (overflowKey && Object.keys(overflow).length) {
    if (overflowKey === "dados") {
      row.dados = { ...overflow, ...(row.dados && typeof row.dados === "object" ? row.dados : {}) };
    } else {
      row[overflowKey] = overflow;
    }
  }

  if (collection === "auditoria") {
    row.uid = data.userId || data.uid || null;
    row.colecao = data.entidade || data.colecao || null;
    row.doc_id = data.entidadeId || data.doc_id || null;
    row.criado_em = data.timestamp || new Date().toISOString();
    row.dados = { ...(data || {}) };
  }

  if (collection === "backups") {
    row.dados = { ...(data || {}) };
    row.criado_em = data.criadoEm || new Date().toISOString();
    row.criado_por = data.criadoPor || null;
  }

  if (collection === "campanhas") {
    row.dados = { ...(data || {}) };
  }

  if (collection === "manuais") {
    if (data.tomboRef && !row.patrimonio_label) row.patrimonio_label = data.tomboRef;
    if (!row.tipo_entrada) row.tipo_entrada = data.tipoEntrada || "Próprio";
  }

  return row;
}

// Colunas que o banco reportou como inexistentes (por tabela) — evita repetir
// tentativas falhas em cada escrita da sessão.
const deadColsByTable = new Map();

/**
 * Upsert com autocorreção: se o Supabase reclamar de coluna inexistente
 * (PGRST204 — ex.: banco sem o upgrade SQL aplicado), move o campo para o
 * JSONB de overflow ou o descarta e tenta de novo, em vez de falhar tudo.
 */
async function upsertRow(sb, c, initialRow) {
  const dead = deadColsByTable.get(c.table);
  let overflowOk = !dead?.has(c.overflow);
  let attempt = initialRow;

  if (dead?.size) {
    attempt = { ...initialRow };
    for (const col of dead) {
      if (!(col in attempt)) continue;
      if (col !== c.overflow && overflowOk && c.overflow && c.overflow !== "dados") {
        const cur = attempt[c.overflow];
        attempt[c.overflow] = { ...(cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {}), [col]: attempt[col] };
      }
      delete attempt[col];
    }
  }

  let lastError = null;

  for (let i = 0; i < 8; i++) {
    const { error } = await sb.from(c.table).upsert(attempt, { onConflict: c.pk });
    if (!error) return null;
    lastError = error;

    const m = error.code === "PGRST204" ? /Could not find the '([^']+)' column/.exec(error.message || "") : null;
    if (!m) return error;

    const col = m[1];
    if (!deadColsByTable.has(c.table)) deadColsByTable.set(c.table, new Set());
    deadColsByTable.get(c.table).add(col);

    const next = { ...attempt };
    if (col === c.overflow) {
      overflowOk = false;
      delete next[col];
    } else {
      if (overflowOk && c.overflow && c.overflow !== "dados") {
        const cur = next[c.overflow];
        next[c.overflow] = { ...(cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {}), [col]: next[col] };
      }
      delete next[col];
    }
    attempt = next;
  }
  return lastError;
}

function applyWhere(query, collection, where = []) {
  let q = query;
  for (const w of where || []) {
    if (!w?.field) continue;
    const field = String(w.field);
    if (collection === "auditoria" && (field === "entidadeId" || field === "entidade")) {
      const col = field === "entidadeId" ? "doc_id" : "colecao";
      q = q.eq(col, w.value);
      continue;
    }
    const col = toSnake(field);
    // ARRAY_CONTAINS em colunas JSONB: PostgREST exige literal JSON
    // (ex. '["u_140_55"]'). Um array JS vira {u_140_55} e dispara
    // "invalid input syntax for type json".
    if (String(w.op || "").toUpperCase() === "ARRAY_CONTAINS") {
      const payload = Array.isArray(w.value) ? w.value : [w.value];
      q = q.filter(col, "cs", JSON.stringify(payload));
      continue;
    }
    q = q.eq(col, w.value);
  }
  return q;
}

function applyOrder(query, orderBy = []) {
  let q = query;
  const arr = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  for (const o of arr) {
    const field = typeof o === "string" ? o : o?.field;
    if (!field || field === "__name__") continue;
    const dir = (typeof o === "object" ? o.direction : "ASCENDING") === "DESCENDING";
    const col = field === "timestamp" ? "criado_em" : toSnake(field);
    q = q.order(col, { ascending: !dir });
  }
  return q;
}

export async function sbGetDoc(collection, docId) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb || !accessToken) return null;
  const id = String(docId || "").trim();
  if (!id) return null;
  const { data, error } = await sb.from(c.table).select("*").eq(c.pk, id).maybeSingle();
  if (error) {
    console.warn(`Supabase get ${collection}/${id}:`, error.message);
    return null;
  }
  return fromRow(collection, data);
}

export async function sbGetDocPublic(collection, docId) {
  const c = cfg(collection);
  const sb = getPublicClient();
  if (!c || !sb) return null;
  const id = String(docId || "").trim();
  if (!id) return null;
  let { data, error } = await sb.from(c.table).select("*").eq(c.pk, id).maybeSingle();
  if (!error && !data && collection === "convites") {
    ({ data, error } = await sb.from(c.table).select("*").eq("token", id).maybeSingle());
  }
  if (!error && !data && collection === "convites_inventariantes") {
    ({ data, error } = await sb.from(c.table).select("*").eq("token", id).maybeSingle());
  }
  if (error) throw new Error(error.message || "Falha ao validar convite");
  if (!data) return null;
  return fromRow(collection, data);
}

export async function sbSet(collection, docId, data) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb || !accessToken) return;
  const row = toRow(collection, docId, data);
  const error = await upsertRow(sb, c, row);
  if (error) {
    console.error(`Supabase set ${collection}/${docId}:`, error.message);
    throw new Error(error.message || `Falha ao salvar em ${collection}`);
  }
}

export async function sbSetStrict(collection, docId, data) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb) throw new Error("Supabase não configurado");
  if (!accessToken) throw new Error("Usuário não autenticado");
  const row = toRow(collection, docId, data);
  const error = await upsertRow(sb, c, row);
  if (error) {
    if (error.code === "42501" || /permission|policy/i.test(error.message)) {
      throw new Error(`Sem permissão no Supabase (${collection}). Verifique as políticas RLS.`);
    }
    throw new Error(error.message || `Falha ao salvar em ${collection}/${docId}`);
  }
  return true;
}

export async function sbDel(collection, docId) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb || !accessToken) return;
  const id = String(docId || "").trim();
  if (!id) return;
  const { error } = await sb.from(c.table).delete().eq(c.pk, id);
  if (error) console.warn(`Supabase del ${collection}/${id}:`, error.message);
}

export async function sbGetAll(collection, opts = {}) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb || !accessToken) return [];

  const pageSize = Math.max(1, Math.min(1000, Number(opts.pageSize || 250) || 250));
  const max = typeof opts.limit === "number" ? Math.max(0, opts.limit) : Infinity;
  const all = [];
  let offset = 0;

  while (all.length < max) {
    const limit = Math.min(pageSize, max - all.length);
    let q = sb.from(c.table).select("*");
    q = applyWhere(q, collection, opts.where);
    q = applyOrder(q, opts.orderBy);
    q = q.range(offset, offset + limit - 1);

    const { data, error } = await q;
    if (error) {
      console.warn(`Supabase list ${collection}:`, error.message);
      break;
    }
    const rows = (data || []).map((r) => fromRow(collection, r));
    all.push(...rows);
    if (!rows.length || rows.length < limit) break;
    offset += rows.length;
  }

  return typeof opts.limit === "number" ? all.slice(0, opts.limit) : all;
}

export async function sbQueryPage(collection, opts = {}) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb || !accessToken) return { docs: [], nextCursor: null, hasMore: false };

  const pageSize = Math.max(1, Math.min(1000, Number(opts.pageSize || 200) || 200));
  const cursor = opts.cursor ? JSON.parse(String(opts.cursor)) : null;
  const orderBy = Array.isArray(opts.orderBy) ? opts.orderBy : opts.orderBy ? [opts.orderBy] : [];
  const orderField = orderBy[0]?.field || orderBy[0] || "id";
  const orderCol = orderField === "__name__" ? cfg(collection)?.pk || "id" : toSnake(String(orderField));

  let q = sb.from(c.table).select("*");
  q = applyWhere(q, collection, opts.where);
  q = applyOrder(q, opts.orderBy);
  if (cursor?.fields?.[orderField] != null) {
    q = q.gt(orderCol, cursor.fields[orderField]);
  } else if (cursor?.fields?.id != null) {
    q = q.gt(orderCol, cursor.fields.id);
  }
  q = q.limit(pageSize + 1);

  const { data, error } = await q;
  if (error) {
    console.warn(`Supabase page ${collection}:`, error.message);
    return { docs: [], nextCursor: null, hasMore: false };
  }

  const mapped = (data || []).map((r) => fromRow(collection, r));
  const hasMore = mapped.length > pageSize;
  const sliced = hasMore ? mapped.slice(0, pageSize) : mapped;
  let nextCursor = null;
  if (hasMore && sliced.length > 0) {
    const last = sliced[sliced.length - 1];
    const fields = {};
    if (orderField && orderField !== "__name__") fields[orderField] = last[orderField] ?? last[toCamel(orderCol)];
    if (fields.id == null && last.id != null) fields.id = last.id;
    nextCursor = JSON.stringify({ fields, docName: last._id });
  }
  return { docs: sliced, nextCursor, hasMore };
}

export function useSupabaseForData() {
  return isSupabaseConfigured();
}
