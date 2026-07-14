/**
 * Migra uma unidade do Firestore → Supabase (restore de dados "sumidos").
 * Uso:
 *   UNIT_ID=u_140_55 TEST_EMAIL=... TEST_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-unit-firestore.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
  const p = resolve(ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const UNIT_ID = process.env.UNIT_ID || "u_140_55";
const EMAIL = process.env.TEST_EMAIL || "";
const PASSWORD = process.env.TEST_PASSWORD || "";
const FB_KEY = process.env.VITE_FB_API_KEY;
const PROJECT = process.env.VITE_FB_PROJECT_ID;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE || "";

if (!EMAIL || !PASSWORD || !FB_KEY || !PROJECT || !SB_URL || !SERVICE) {
  console.error("Faltam credenciais (TEST_EMAIL/PASSWORD, Firebase, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

function fromFs(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) {
    const o = {};
    for (const k in v.mapValue.fields || {}) o[k] = fromFs(v.mapValue.fields[k]);
    return o;
  }
  return null;
}

function fromFsDoc(doc) {
  const obj = {};
  for (const k in doc.fields || {}) obj[k] = fromFs(doc.fields[k]);
  obj._id = doc.name.split("/").pop();
  return obj;
}

async function firebaseLogin() {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d;
}

async function queryAll(token, collection, field, value) {
  const RUN = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${FB_KEY}`;
  const out = [];
  let last = null;
  while (true) {
    const structuredQuery = {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: "EQUAL",
          value: { stringValue: value },
        },
      },
      orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
      limit: 300,
    };
    if (last) {
      structuredQuery.startAt = { before: false, values: [{ referenceValue: last }] };
    }
    const res = await fetch(RUN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ structuredQuery }),
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    const docs = rows.map((x) => x.document).filter(Boolean);
    for (const d of docs) out.push(fromFsDoc(d));
    if (docs.length < 300) break;
    last = docs[docs.length - 1].name;
  }
  return out;
}

function inventoryRow(d) {
  const known = new Set([
    "patrimonioId", "unidadeId", "unidadeNome", "estado", "situacao", "localId", "obs", "marca",
    "origem", "fotoUrls", "data", "hora", "usuario", "user", "email", "ultimaAtualizacao",
    "isManual", "descricaoEdit", "especieEdit", "imei", "semTombo", "tomboReferencia",
    "permutaDesc", "permutaMarca", "permutaEstado", "identificadoPorFoto", "_id",
  ]);
  const extras = {};
  for (const [k, v] of Object.entries(d)) {
    if (known.has(k) || v === undefined) continue;
    extras[k] = v;
  }
  return {
    patrimonio_id: String(d._id || d.patrimonioId || ""),
    unidade_id: d.unidadeId || UNIT_ID,
    unidade_nome: d.unidadeNome || null,
    estado: d.estado || null,
    situacao: d.situacao || null,
    local_id: typeof d.localId === "string" ? d.localId : d.localId?.id || null,
    obs: d.obs || "",
    marca: d.marca || "",
    origem: d.origem || "Próprio",
    foto_urls: Array.isArray(d.fotoUrls) ? d.fotoUrls : [],
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
    extras,
  };
}

function localRow(d) {
  const unidadeIds = Array.isArray(d.unidadeIds)
    ? d.unidadeIds.filter(Boolean)
    : d.unidadeId
      ? [d.unidadeId]
      : [UNIT_ID];
  return {
    id: String(d._id || d.id || ""),
    nome: d.nome || "Local",
    unidade_id: d.unidadeId || unidadeIds[0] || UNIT_ID,
    unidade_ids: unidadeIds,
    criado_por: d.criadoPor || null,
    criado_em: d.criadoEm || null,
    desc: d.desc || "",
    session_id: d.sessionId || "",
    extras: {},
  };
}

function manualRow(d) {
  return {
    id: String(d._id || d.id || ""),
    unidade_id: d.unidadeId || UNIT_ID,
    patrimonio_label: d.patrimonioLabel || d.tomboRef || null,
    data: d.data || null,
    especie: d.especie || null,
    descricao: d.descricao || null,
    marca: d.marca || null,
    fornecedor: d.fornecedor || null,
    empenho: d.empenho || null,
    nf: d.nf || null,
    data_nf: d.dataNF || d.dataNf || null,
    tipo_entrada: d.tipoEntrada || "Próprio",
    valor: Number(d.valor || 0) || 0,
    valor_atual: Number(d.valorAtual || 0) || 0,
    imei: d.imei || null,
    extras: {
      ...(d.semTombo ? { semTombo: true } : {}),
      ...(d.tomboRef ? { tomboRef: d.tomboRef } : {}),
      ...(d.identificadoPorFoto ? { identificadoPorFoto: true } : {}),
    },
  };
}

async function upsertBatch(sb, table, rows, pk) {
  let ok = 0;
  let fail = 0;
  const size = 50;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).filter((r) => r[pk]);
    if (!chunk.length) continue;
    const { error } = await sb.from(table).upsert(chunk, { onConflict: pk });
    if (error) {
      console.error(`  FAIL ${table} batch ${i}:`, error.message);
      // tenta um a um
      for (const row of chunk) {
        const { error: e2 } = await sb.from(table).upsert(row, { onConflict: pk });
        if (e2) {
          fail++;
          console.error(`    ${row[pk]}:`, e2.message);
        } else ok++;
      }
    } else {
      ok += chunk.length;
    }
  }
  return { ok, fail };
}

async function main() {
  console.log(`\n=== Migração Firestore → Supabase: ${UNIT_ID} ===\n`);
  const auth = await firebaseLogin();
  console.log("Login OK:", auth.email);

  const sb = createClient(SB_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [inv, locs, mans] = await Promise.all([
    queryAll(auth.idToken, "inventario", "unidadeId", UNIT_ID),
    queryAll(auth.idToken, "locais", "unidadeId", UNIT_ID),
    queryAll(auth.idToken, "manuais", "unidadeId", UNIT_ID),
  ]);

  console.log(`Firestore: inventario=${inv.length} locais=${locs.length} manuais=${mans.length}`);

  const invRows = inv.map(inventoryRow).filter((r) => r.patrimonio_id);
  const locRows = locs.map(localRow).filter((r) => r.id);
  const manRows = mans.map(manualRow).filter((r) => r.id);

  console.log("Upsert locais...");
  const rLoc = await upsertBatch(sb, "locais", locRows, "id");
  console.log(`  locais ok=${rLoc.ok} fail=${rLoc.fail}`);

  console.log("Upsert manuais...");
  const rMan = await upsertBatch(sb, "manuais", manRows, "id");
  console.log(`  manuais ok=${rMan.ok} fail=${rMan.fail}`);

  console.log("Upsert inventario...");
  const rInv = await upsertBatch(sb, "inventario", invRows, "patrimonio_id");
  console.log(`  inventario ok=${rInv.ok} fail=${rInv.fail}`);

  const { count: cInv } = await sb.from("inventario").select("*", { count: "exact", head: true }).eq("unidade_id", UNIT_ID);
  const { count: cLoc } = await sb.from("locais").select("*", { count: "exact", head: true }).eq("unidade_id", UNIT_ID);
  const { count: cMan } = await sb.from("manuais").select("*", { count: "exact", head: true }).eq("unidade_id", UNIT_ID);
  console.log(`\nSupabase agora: inventario=${cInv} locais=${cLoc} manuais=${cMan}`);
  console.log("\nConcluído. No app: Inventariar → selecionar CREAS CIDADE OPERARIA (ou Finalizados → Editar).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
