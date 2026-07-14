/**
 * Remove locais duplicados por nome+unidade (ex.: várias "Recepção" vazias).
 * Mantém o que tiver mais itens; empate → o mais antigo.
 *
 * Uso:
 *   UNIT_ID=u_140_55 node scripts/dedupe-locais.mjs
 *   DRY_RUN=1 UNIT_ID=u_140_55 node scripts/dedupe-locais.mjs
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

const UNIT_ID = process.env.UNIT_ID || "";
const DRY_RUN = String(process.env.DRY_RUN || "0") === "1";
const SB_URL = process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE || "";

if (!SB_URL || !SERVICE) {
  console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function normalizeNome(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function createdMs(row) {
  const iso = Date.parse(row?.criado_em || "");
  if (Number.isFinite(iso)) return iso;
  const m = String(row?.id || "").match(/^loc_(\d+)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function unitMatch(row, unitId) {
  if (!unitId) return true;
  if (row.unidade_id === unitId) return true;
  const ids = Array.isArray(row.unidade_ids) ? row.unidade_ids : [];
  return ids.includes(unitId);
}

const sb = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

const { data: locais, error: locErr } = await sb.from("locais").select("*");
if (locErr) throw locErr;

const scoped = (locais || []).filter((l) => unitMatch(l, UNIT_ID));
console.log(`Locais${UNIT_ID ? ` unidade ${UNIT_ID}` : ""}: ${scoped.length}`);

const { data: invRows, error: invErr } = await sb
  .from("inventario")
  .select("patrimonio_id,local_id,unidade_id")
  .limit(20000);
if (invErr) throw invErr;

const counts = new Map();
for (const row of invRows || []) {
  if (UNIT_ID && row.unidade_id && row.unidade_id !== UNIT_ID) continue;
  const lid = row.local_id;
  if (!lid) continue;
  counts.set(lid, (counts.get(lid) || 0) + 1);
}

const byKey = new Map();
for (const l of scoped) {
  const key = `${normalizeNome(l.nome)}::${UNIT_ID || l.unidade_id || (l.unidade_ids || [])[0] || ""}`;
  if (!normalizeNome(l.nome)) continue;
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(l);
}

const toDelete = [];
const keepers = [];

for (const [key, group] of byKey) {
  if (group.length < 2) continue;
  group.sort((a, b) => {
    const ca = counts.get(a.id) || 0;
    const cb = counts.get(b.id) || 0;
    if (cb !== ca) return cb - ca;
    return createdMs(a) - createdMs(b);
  });
  const keeper = group[0];
  keepers.push({
    key,
    keeper: keeper.id,
    nome: keeper.nome,
    items: counts.get(keeper.id) || 0,
    dupes: group.slice(1).map((d) => ({ id: d.id, items: counts.get(d.id) || 0 })),
  });
  for (const d of group.slice(1)) {
    const n = counts.get(d.id) || 0;
    if (n > 0) {
      console.warn(`SKIP delete ${d.id} (${d.nome}): ainda tem ${n} itens — remapeie antes`);
      continue;
    }
    toDelete.push(d.id);
  }
}

console.log("Grupos duplicados:", keepers.length);
for (const k of keepers) {
  console.log(`  keep ${k.keeper} "${k.nome}" (${k.items} itens); delete candidates:`, k.dupes);
}
console.log(`A apagar (vazios): ${toDelete.length}${DRY_RUN ? " [DRY_RUN]" : ""}`);

if (!DRY_RUN && toDelete.length) {
  const { error: delErr } = await sb.from("locais").delete().in("id", toDelete);
  if (delErr) throw delErr;
  console.log("Removidos:", toDelete.join(", "));
} else if (DRY_RUN) {
  console.log("IDs que seriam removidos:", toDelete.join(", ") || "(nenhum)");
}
