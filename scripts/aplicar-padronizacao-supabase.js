/**
 * Aplica correcoes_sem_tombo.csv direto no Supabase
 * (tabelas inventario + manuais — NÃO existe public.bens).
 *
 * Uso:
 *   node scripts/aplicar-padronizacao-supabase.js
 *   node scripts/aplicar-padronizacao-supabase.js --apply
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://kjywmxhwphkhudzswwus.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqeXdteGh3cGhraHVkenN3d3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzI3NTQsImV4cCI6MjA5ODk0ODc1NH0.GpmIs63HeyvFY4q3FhWeyAUhQZlpfEfqKMhd9fwY6Ok";

const CSV_PATH =
  process.env.CORRECOES_CSV ||
  path.resolve("C:/Users/PC/Desktop/BATIMENTO DE COMPRAS/correcoes_sem_tombo.csv");

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^\d+[\d.]*\s*-\s*/, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(s) {
  return new Set(norm(s).split(" ").filter((t) => t.length > 2));
}

function tokenScore(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(A.size, B.size);
}

function parseCsv(raw) {
  const lines = raw.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines[0].split(";");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(";");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (cols[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

function especieFromCategoria(cat) {
  const c = String(cat || "").trim().toUpperCase();
  if (!c || c === "FORA DE CATEGORIA" || c === "INSERVIVEL") return null;
  if (c.startsWith("CADEIRA")) return "CADEIRA";
  if (c.startsWith("MESA")) return "MESA";
  if (c.startsWith("ARM")) return "ARMÁRIO";
  return c.split(/\s+/)[0] || null;
}

function descLoose(s) {
  return norm(s)
    .replace(/\bC BRA[CÇ]O\b/g, "COM BRACO")
    .replace(/\bS BRA[CÇ]O\b/g, "SEM BRACO")
    .replace(/\bC\b/g, "COM")
    .replace(/\bS\b/g, "SEM");
}

async function fetchAll(table, columns) {
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

function unitMatches(csvUnit, dbUnit) {
  const a = norm(csvUnit);
  const b = norm(dbUnit);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return tokenScore(a, b) >= 0.7;
}

function localMatches(csvLocal, dbLocal) {
  const a = norm(csvLocal);
  const b = norm(dbLocal);
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return tokenScore(a, b) >= 0.6;
}

function descMatches(csvDesc, dbDesc) {
  const a = descLoose(csvDesc);
  const b = descLoose(dbDesc);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // mesmas palavras principais
  return tokenScore(a, b) >= 0.55;
}

async function main() {
  console.log(APPLY ? ">>> MODO APPLY (vai gravar)" : ">>> DRY-RUN (não grava)");
  console.log("CSV:", CSV_PATH);

  const csvRows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
  console.log("Linhas CSV:", csvRows.length);

  const [inventario, manuais, locais] = await Promise.all([
    fetchAll(
      "inventario",
      "patrimonio_id,descricao_edit,especie_edit,unidade_id,unidade_nome,local_id,is_manual,sem_tombo,extras"
    ),
    fetchAll("manuais", "id,descricao,especie,unidade_id,extras"),
    fetchAll("locais", "id,nome,unidade_id"),
  ]);

  const localById = new Map(locais.map((l) => [l.id, l]));
  const invById = new Map(inventario.map((r) => [String(r.patrimonio_id), r]));
  const manById = new Map(manuais.map((r) => [String(r.id), r]));
  const invByInterno = new Map();
  for (const r of inventario) {
    const iid = r.id_interno || r.extras?.idInterno;
    if (iid) invByInterno.set(String(iid), r);
  }

  const candidates = [];
  for (const r of inventario) {
    const id = String(r.patrimonio_id || "");
    if (!(r.is_manual || r.sem_tombo || /^(MAN_|ST_)/i.test(id))) continue;
    const man = manById.get(id);
    const desc = r.descricao_edit || man?.descricao || "";
    const localNome = localById.get(r.local_id)?.nome || "";
    candidates.push({
      ...r,
      desc,
      localNome,
    });
  }
  console.log("Candidatos manuais/ST no banco:", candidates.length);

  const updates = [];
  const usedInv = new Set();
  const skipped = [];
  const ambiguous = [];

  for (const row of csvRows) {
    const idOrig = row.id_origem || "";
    const idInternoCsv = row.id_interno || row.idInterno || row.id_supabase || "";
    const nome = row.nome_padronizado || "";
    const cat = row.categoria_corrigida || "";
    const esp = especieFromCategoria(cat);
    if (!nome) {
      skipped.push({ ordem: row.ordem_no_relatorio, reason: "sem nome_padronizado" });
      continue;
    }
    if (cat === "FORA DE CATEGORIA" || cat === "INSERVIVEL") {
      skipped.push({ ordem: row.ordem_no_relatorio, reason: "fora/inservivel" });
      continue;
    }

    if (idInternoCsv && invByInterno.has(idInternoCsv) && !usedInv.has(invByInterno.get(idInternoCsv).patrimonio_id)) {
      const r = invByInterno.get(idInternoCsv);
      const man = manById.get(String(r.patrimonio_id));
      updates.push({
        patrimonio_id: String(r.patrimonio_id),
        nome,
        especie: esp,
        match: "id_interno",
        csvOrdem: row.ordem_no_relatorio,
        antes: r.descricao_edit || man?.descricao || null,
      });
      usedInv.add(String(r.patrimonio_id));
      continue;
    }

    if (/^(MAN_|ST_)/i.test(idOrig) && invById.has(idOrig) && !usedInv.has(idOrig)) {
      const r = invById.get(idOrig);
      const man = manById.get(idOrig);
      updates.push({
        patrimonio_id: idOrig,
        nome,
        especie: esp,
        match: "id_exato",
        csvOrdem: row.ordem_no_relatorio,
        antes: r.descricao_edit || man?.descricao || null,
      });
      usedInv.add(idOrig);
      continue;
    }

    const pool = candidates.filter((c) => {
      if (usedInv.has(String(c.patrimonio_id))) return false;
      if (!unitMatches(row.unidade, c.unidade_nome)) return false;
      if (!localMatches(row.local, c.localNome)) return false;
      if (!descMatches(row.descricao_original, c.desc)) return false;
      return true;
    });

    if (pool.length >= 1) {
      const r = pool[0];
      updates.push({
        patrimonio_id: String(r.patrimonio_id),
        nome,
        especie: esp,
        match: pool.length === 1 ? "fuzzy_unico" : "fuzzy_lote",
        csvOrdem: row.ordem_no_relatorio,
        antes: r.desc,
      });
      usedInv.add(String(r.patrimonio_id));
      continue;
    }

    // sem local
    const pool2 = candidates.filter((c) => {
      if (usedInv.has(String(c.patrimonio_id))) return false;
      if (!unitMatches(row.unidade, c.unidade_nome)) return false;
      if (!descMatches(row.descricao_original, c.desc)) return false;
      return true;
    });
    if (pool2.length >= 1) {
      const r = pool2[0];
      updates.push({
        patrimonio_id: String(r.patrimonio_id),
        nome,
        especie: esp,
        match: "fuzzy_sem_local",
        csvOrdem: row.ordem_no_relatorio,
        antes: r.desc,
      });
      usedInv.add(String(r.patrimonio_id));
      continue;
    }

    ambiguous.push({
      ordem: row.ordem_no_relatorio,
      idOrig,
      unidade: row.unidade,
      local: row.local,
      desc: row.descricao_original,
      nome,
    });
  }

  const byMatch = updates.reduce((a, u) => {
    a[u.match] = (a[u.match] || 0) + 1;
    return a;
  }, {});

  console.log("\n=== RESUMO ===");
  console.log("Updates preparados:", updates.length);
  console.log("Por tipo de match:", byMatch);
  console.log("Pulados:", skipped.length);
  console.log("Sem match:", ambiguous.length);
  console.log("\nAmostra (8):");
  for (const u of updates.slice(0, 8)) {
    console.log(`  [${u.match}] ${u.patrimonio_id}`);
    console.log(`    antes : ${u.antes}`);
    console.log(`    depois: ${u.nome}`);
  }
  if (ambiguous.length) {
    console.log("\nSem match (8):");
    for (const a of ambiguous.slice(0, 8)) {
      console.log(`  #${a.ordem} | ${a.unidade} | ${a.local} | ${a.desc}`);
    }
  }

  const outDir = path.resolve(__dirname, "../tmp");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "padronizacao-plan.json"),
    JSON.stringify({ updates, skipped, ambiguous }, null, 2),
    "utf8"
  );
  console.log("\nPlano: tmp/padronizacao-plan.json");

  if (!APPLY) {
    console.log("\nPara gravar: node scripts/aplicar-padronizacao-supabase.js --apply");
    return;
  }

  let okInv = 0;
  let okMan = 0;
  let fail = 0;
  for (const u of updates) {
    const payload = {
      descricao_edit: u.nome,
      ultima_atualizacao: new Date().toISOString(),
    };
    if (u.especie) payload.especie_edit = u.especie;

    const { error } = await sb.from("inventario").update(payload).eq("patrimonio_id", u.patrimonio_id);
    if (error) {
      console.error("FAIL inventario", u.patrimonio_id, error.message);
      fail++;
      continue;
    }
    okInv++;

    if (manById.has(u.patrimonio_id)) {
      const manPayload = { descricao: u.nome };
      if (u.especie) manPayload.especie = u.especie;
      const { error: em } = await sb.from("manuais").update(manPayload).eq("id", u.patrimonio_id);
      if (!em) okMan++;
      else console.error("FAIL manuais", u.patrimonio_id, em.message);
    }
  }

  console.log("\n=== APLICADO ===");
  console.log("inventario:", okInv, "| manuais:", okMan, "| falhas:", fail);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
