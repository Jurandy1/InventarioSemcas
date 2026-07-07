import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  resolve(__dirname, "serviceAccountKey.json");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}
if (!existsSync(KEY_PATH)) {
  console.error(`Service account não encontrada: ${KEY_PATH}`);
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))) });
const db = getFirestore();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAP = {
  inventario: {
    table: "inventario",
    transform: (id, d) => ({
      patrimonio_id: id,
      unidade_id: d.unidadeId || "",
      unidade_nome: d.unidadeNome || null,
      estado: d.estado || null,
      situacao: d.situacao || null,
      local_id: d.localId || null,
      obs: d.obs || "",
      marca: d.marca || "",
      origem: d.origem || "Próprio",
      foto_urls: d.fotoUrls || [],
      data: d.data || null,
      hora: d.hora || null,
      usuario: d.usuario || d.user || null,
      email: d.email || null,
      ultima_atualizacao: d.ultimaAtualizacao || null,
      is_manual: Boolean(d.isManual),
      descricao_edit: d.descricaoEdit || null,
      especie_edit: d.especieEdit || null,
      imei: d.imei || null,
      sem_tombo: d.semTombo ?? null,
      tombo_referencia: d.tomboReferencia || null,
      permuta_desc: d.permutaDesc || null,
      permuta_marca: d.permutaMarca || null,
      permuta_estado: d.permutaEstado || null,
      identificado_por_foto: d.identificadoPorFoto ?? null,
      extras: {},
    }),
  },
  manuais: {
    table: "manuais",
    transform: (id, d) => ({
      id,
      unidade_id: d.unidadeId || "",
      patrimonio_label: d.patrimonioLabel || null,
      data: d.data || "",
      especie: d.especie || "",
      descricao: d.descricao || "",
      marca: d.marca || "",
      fornecedor: d.fornecedor || "",
      empenho: d.empenho || "",
      nf: d.nf || "",
      data_nf: d.dataNF || "",
      tipo_entrada: d.tipoEntrada || "Próprio",
      valor: Number(d.valor || 0) || 0,
      valor_atual: Number(d.valorAtual || 0) || 0,
      imei: d.imei || null,
    }),
  },
  locais: {
    table: "locais",
    transform: (id, d) => ({
      id,
      nome: d.nome || "",
      unidade_id: d.unidadeId || null,
      unidade_ids: d.unidadeIds || [],
      criado_por: d.criadoPor || null,
    }),
  },
  inventariantes: {
    table: "inventariantes",
    transform: (id, d) => ({
      uid: id,
      email: d.email || null,
      nome: d.nome || null,
      matricula: d.matricula || null,
      unidade_id: d.unidadeId || null,
      unidade_ids: d.unidadeIds || [],
      status: d.status || "pendente",
    }),
  },
  coordenadores: {
    table: "coordenadores",
    transform: (id, d) => ({
      uid: id,
      email: d.email || null,
      nome: d.nome || null,
      matricula: d.matricula || null,
      unidade_id: d.unidadeId || null,
      unidade_ids: d.unidadeIds || [],
      status: d.status || "pendente",
    }),
  },
  tombosNE: {
    table: "tombos_ne",
    transform: (id, d) => ({
      id,
      unidade_id: d.unidadeId || null,
      descricao: d.descricao || null,
      obs: d.obs || null,
      usuario: d.usuario || null,
      data: d.data || null,
      extras: d,
    }),
  },
  finalizacoes: {
    table: "finalizacoes",
    transform: (id, d) => ({
      id,
      campanha_id: d.campanhaId || "ativa",
      unidade_ids: d.unidadeIds || [],
      unidade_nomes: d.unidadeNomes || [],
      session_id: d.sessionId || null,
      finalized_at: d.finalizedAt || null,
      finalized_by: d.finalizedBy || {},
      coordenadora: d.coordenadora || {},
      convite_token: d.conviteToken || null,
      stats: {
        ...(d.stats || {}),
        ...(d.ultimaEdicao ? { ultimaEdicao: d.ultimaEdicao } : {}),
      },
      status: d.status || "finalizado",
      ultima_edicao: null,
    }),
  },
  campanhas: {
    table: "campanhas",
    transform: (id, d) => ({ id, status: d.status || "aberta", dados: d }),
  },
  convites: {
    table: "convites",
    transform: (id, d) => ({
      id,
      token: d.token || null,
      status: d.status || "ativo",
      criado_por: d.criadoPor || null,
      data_criacao: d.dataCriacao || null,
      data_expiracao: d.dataExpiracao || null,
      usado_por: d.usadoPor || null,
      extras: {},
    }),
  },
  convites_inventariantes: {
    table: "convites_inventariantes",
    transform: (id, d) => ({
      id,
      token: d.token || null,
      status: d.status || "ativo",
      criado_por: d.criadoPor || null,
      data_criacao: d.dataCriacao || null,
      data_expiracao: d.dataExpiracao || null,
      usado_por: d.usadoPor || null,
      extras: {},
    }),
  },
  cadastro_indice: {
    table: "cadastro_indice",
    transform: (id, d) => ({
      id,
      uid: d.uid || null,
      email: d.email || null,
      matricula: d.matricula || null,
      nome: d.nome || null,
      status: d.status || "ativo",
    }),
  },
  presenca_inventario: {
    table: "presenca_inventario",
    transform: (id, d) => ({
      uid: id,
      nome: d.nome || null,
      unidade_ids: d.unidadeIds || [],
      item_em_edicao: d.itemEmEdicao || null,
      item_descricao: d.itemDescricao || null,
      atualizado_em: d.atualizadoEm || new Date().toISOString(),
    }),
  },
  aprovacoes: {
    table: "aprovacoes",
    transform: (id, d) => ({ id, item_id: d.itemId || null, approver_id: d.approverId || null, dados: d }),
  },
  rejeicoes: {
    table: "rejeicoes",
    transform: (id, d) => ({ id, item_id: d.itemId || null, approver_id: d.approverId || null, dados: d }),
  },
};

console.log("Migrando Firestore → Supabase...\n");

const PK = {
  inventario: "patrimonio_id",
  inventariantes: "uid",
  coordenadores: "uid",
  presenca_inventario: "uid",
};


let totalDocs = 0;
const summary = [];

for (const [collection, cfg] of Object.entries(MAP)) {
  const snap = await db.collection(collection).get();
  const rows = snap.docs.map((doc) => cfg.transform(doc.id, doc.data()));

  if (rows.length === 0) {
    console.log(`⏭  ${collection}: vazio`);
    summary.push({ collection, table: cfg.table, count: 0 });
    continue;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const onConflict = PK[cfg.table] || "id";
    const { error } = await supabase.from(cfg.table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`❌ ${collection} → ${cfg.table}:`, error.message);
      if (error.message.includes("does not exist") || error.code === "PGRST205") {
        console.error("   → Rode scripts/supabase-schema.sql no Supabase SQL Editor primeiro.");
      }
      process.exit(1);
    }
    inserted += chunk.length;
  }

  console.log(`✅ ${collection}: ${inserted} → ${cfg.table}`);
  totalDocs += inserted;
  summary.push({ collection, table: cfg.table, count: inserted });
}

console.log(`\n🎉 Migração concluída! ${totalDocs} documento(s) no total.\n`);
for (const s of summary) {
  if (s.count > 0) console.log(`   ${s.table}: ${s.count}`);
}
