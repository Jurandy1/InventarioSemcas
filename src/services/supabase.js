import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let authClient = null;
/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let publicClient = null;
let accessToken = null;

const COL = {
  inventario: { table: "inventario", pk: "patrimonio_id" },
  manuais: { table: "manuais", pk: "id" },
  locais: { table: "locais", pk: "id" },
  inventariantes: { table: "inventariantes", pk: "uid" },
  coordenadores: { table: "coordenadores", pk: "uid" },
  tombosNE: { table: "tombos_ne", pk: "id" },
  finalizacoes: { table: "finalizacoes", pk: "id" },
  campanhas: { table: "campanhas", pk: "id" },
  auditoria: { table: "auditoria", pk: "id" },
  convites: { table: "convites", pk: "id" },
  convites_inventariantes: { table: "convites_inventariantes", pk: "id" },
  cadastro_indice: { table: "cadastro_indice", pk: "id" },
  presenca_inventario: { table: "presenca_inventario", pk: "uid" },
  aprovacoes: { table: "aprovacoes", pk: "id" },
  rejeicoes: { table: "rejeicoes", pk: "id" },
  backups: { table: "backups", pk: "id" },
};

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

const SNAKE_OVERRIDES = Object.fromEntries(
  Object.entries(CAMEL_OVERRIDES).map(([camel, snake]) => [snake, camel])
);

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
  const known = new Set(["id", "extras", "dados"]);
  if (c) known.add(c.pk);

  const row = {};
  const extras = {};

  for (const [k, v] of Object.entries(data || {})) {
    if (k === "_id") continue;
    const snake = toSnake(k);
    if (c && snake === c.pk) {
      row[snake] = v;
      continue;
    }
    if (
      collection === "auditoria" &&
      ["timestamp", "userId", "entidade", "entidadeId", "antes", "depois", "mudancas"].includes(k)
    ) {
      continue;
    }
    row[snake] = v;
    known.add(snake);
  }

  if (c) row[c.pk] = docId;

  for (const [k, v] of Object.entries(data || {})) {
    if (k === "_id") continue;
    const snake = toSnake(k);
    if (!(snake in row) && !known.has(snake)) extras[k] = v;
  }
  if (Object.keys(extras).length) row.extras = extras;

  if (collection === "auditoria") {
    row.uid = data.userId || data.uid || null;
    row.colecao = data.entidade || data.colecao || null;
    row.doc_id = data.entidadeId || data.doc_id || null;
    row.criado_em = data.timestamp || new Date().toISOString();
    row.dados = { ...(data || {}), ...(row.dados || {}) };
    delete row.extras;
  }

  if (collection === "backups") {
    row.dados = { ...(data || {}) };
    row.criado_em = data.criadoEm || new Date().toISOString();
    row.criado_por = data.criadoPor || null;
  }

  if (collection === "campanhas") {
    row.dados = { ...(data || {}) };
  }

  return row;
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
    q = q.eq(toSnake(field), w.value);
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
  const { error } = await sb.from(c.table).upsert(row, { onConflict: c.pk });
  if (error) console.warn(`Supabase set ${collection}/${docId}:`, error.message);
}

export async function sbSetStrict(collection, docId, data) {
  const c = cfg(collection);
  const sb = getAuthClient();
  if (!c || !sb) throw new Error("Supabase não configurado");
  if (!accessToken) throw new Error("Usuário não autenticado");
  const row = toRow(collection, docId, data);
  const { error } = await sb.from(c.table).upsert(row, { onConflict: c.pk });
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
