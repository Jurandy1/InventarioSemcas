/**
 * Gera UUID (idInterno) para todos os registros de inventario e manuais
 * que ainda não têm. Grava em extras.idInterno (e em id_interno se a coluna existir).
 *
 * Uso:
 *   node scripts/backfill-id-interno.js
 *   node scripts/backfill-id-interno.js --apply
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 25;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://kjywmxhwphkhudzswwus.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqeXdteGh3cGhraHVkenN3d3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzI3NTQsImV4cCI6MjA5ODk0ODc1NH0.GpmIs63HeyvFY4q3FhWeyAUhQZlpfEfqKMhd9fwY6Ok";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const PAGE = 1000;

function readIdInterno(row) {
  if (row?.id_interno) return String(row.id_interno);
  const ex = row?.extras;
  if (ex && typeof ex === "object" && !Array.isArray(ex) && ex.idInterno) {
    return String(ex.idInterno);
  }
  return "";
}

async function fetchAll(table, select) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function mapPool(items, concurrency, fn) {
  let i = 0;
  let ok = 0;
  let fail = 0;
  let colMissing = false;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      try {
        const missing = await fn(item);
        if (missing) colMissing = true;
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 8) console.warn(`Falha:`, e?.message || e);
      }
      if ((ok + fail) % 200 === 0 || ok + fail === items.length) {
        console.log(`  progresso ${ok + fail}/${items.length} (ok=${ok} fail=${fail})`);
      }
    }
  });
  await Promise.all(workers);
  return { ok, fail, colMissing };
}

async function main() {
  console.log(APPLY ? ">>> MODO APPLY (vai gravar)" : ">>> DRY-RUN (não grava)");

  const [invRows, manRows] = await Promise.all([
    fetchAll("inventario", "patrimonio_id, extras"),
    fetchAll("manuais", "id, extras"),
  ]);

  console.log(`inventario: ${invRows.length} | manuais: ${manRows.length}`);

  const invById = new Map(invRows.map((r) => [String(r.patrimonio_id), r]));
  const manById = new Map(manRows.map((r) => [String(r.id), r]));

  const invUpdates = [];
  const manUpdates = [];

  for (const row of invRows) {
    const existing = readIdInterno(row);
    if (existing) continue;
    const man = manById.get(String(row.patrimonio_id));
    const fromMan = man ? readIdInterno(man) : "";
    const idInterno = fromMan || randomUUID();
    const extras = { ...(row.extras && typeof row.extras === "object" ? row.extras : {}), idInterno };
    invUpdates.push({ patrimonio_id: row.patrimonio_id, extras, id_interno: idInterno });
  }

  for (const row of manRows) {
    const existing = readIdInterno(row);
    if (existing) {
      const inv = invById.get(String(row.id));
      if (inv && !readIdInterno(inv)) {
        const extras = { ...(inv.extras && typeof inv.extras === "object" ? inv.extras : {}), idInterno: existing };
        invUpdates.push({ patrimonio_id: inv.patrimonio_id, extras, id_interno: existing });
      }
      continue;
    }
    const inv = invById.get(String(row.id));
    const fromInv = inv ? readIdInterno(inv) : "";
    const pendingInv = invUpdates.find((u) => String(u.patrimonio_id) === String(row.id));
    const idInterno = fromInv || pendingInv?.id_interno || randomUUID();
    const extras = { ...(row.extras && typeof row.extras === "object" ? row.extras : {}), idInterno };
    manUpdates.push({ id: row.id, extras, id_interno: idInterno });
  }

  const invMap = new Map();
  for (const u of invUpdates) invMap.set(String(u.patrimonio_id), u);
  const invFinal = [...invMap.values()];

  console.log(`\nVão receber idInterno: inventario=${invFinal.length} manuais=${manUpdates.length}`);
  console.log("Amostra inventário:", invFinal.slice(0, 3).map((u) => `${u.patrimonio_id} → ${u.id_interno}`));
  console.log("Amostra manuais:", manUpdates.slice(0, 3).map((u) => `${u.id} → ${u.id_interno}`));

  if (!APPLY) {
    console.log("\nDry-run ok. Rode com --apply para gravar.");
    return;
  }

  if (!invFinal.length && !manUpdates.length) {
    console.log("\nNada a fazer — todos já têm idInterno.");
    return;
  }

  async function patchRow(table, pk, payload) {
    let res = await sb.from(table).update({ extras: payload.extras, id_interno: payload.id_interno }).eq(pk, payload[pk]);
    if (res.error && /id_interno|schema cache|PGRST204/i.test(res.error.message || "")) {
      res = await sb.from(table).update({ extras: payload.extras }).eq(pk, payload[pk]);
      if (res.error) throw new Error(res.error.message);
      return true; // coluna ausente
    }
    if (res.error) throw new Error(res.error.message);
    return false;
  }

  console.log("\nAtualizando inventario...");
  const invRes = await mapPool(invFinal, CONCURRENCY, (u) =>
    patchRow("inventario", "patrimonio_id", {
      patrimonio_id: u.patrimonio_id,
      extras: u.extras,
      id_interno: u.id_interno,
    })
  );

  console.log("Atualizando manuais...");
  const manRes = await mapPool(manUpdates, CONCURRENCY, (u) =>
    patchRow("manuais", "id", {
      id: u.id,
      extras: u.extras,
      id_interno: u.id_interno,
    })
  );

  console.log(`\nConcluído inventario: ok=${invRes.ok} fail=${invRes.fail}`);
  console.log(`Concluído manuais: ok=${manRes.ok} fail=${manRes.fail}`);
  if (invRes.colMissing || manRes.colMissing) {
    console.log("Nota: coluna id_interno ainda não existe — gravado só em extras.idInterno.");
    console.log("Rode o trecho de id_interno em scripts/supabase-upgrade.sql no SQL Editor.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
