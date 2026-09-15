/**
 * Aplica inventario_semcas_categorizado.xlsx no Supabase por ID interno.
 * - Sempre grava categoria + subcategoria (extras)
 * - Atualiza descrição / marca / espécie quando houver correção
 *
 * Uso:
 *   node scripts/aplicar-categorizacao-xlsx.js
 *   node scripts/aplicar-categorizacao-xlsx.js --apply
 */
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 20;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://kjywmxhwphkhudzswwus.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqeXdteGh3cGhraHVkenN3d3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzI3NTQsImV4cCI6MjA5ODk0ODc1NH0.GpmIs63HeyvFY4q3FhWeyAUhQZlpfEfqKMhd9fwY6Ok";

const XLSX_PATH =
  process.env.CATEGORIZADO_XLSX ||
  path.resolve("C:/Users/PC/Desktop/BATIMENTO DE COMPRAS/inventario_semcas_categorizado.xlsx");

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const PAGE = 1000;

function yes(v) {
  return String(v || "")
    .trim()
    .toLowerCase() === "sim";
}

function cleanMarca(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^(não informado|nao informado|n\/i|ni|\(em branco\)|-)$/i.test(s)) return "";
  return s;
}

/** Espécie curta para filtros legados (regex / relatórios). */
function especieFromCategoria(categoria, subcategoria, descricao) {
  const cat = String(categoria || "").toUpperCase();
  const sub = String(subcategoria || "").toUpperCase();
  const desc = String(descricao || "").toUpperCase();
  const hay = `${sub} ${desc}`;

  if (/LONGARINA/.test(hay)) return "LONGARINA";
  if (/CADEIRA|ASSENTO|POLTRONA|UNIVERSIT/.test(hay) || /ASSENTOS/.test(cat)) return "CADEIRA";
  if (/MESA|GUICH|SUPERFÍCIE|SUPERFICIE|CONJUNTO DE MESA/.test(hay) || /MESAS/.test(cat)) return "MESA";
  if (/ARMÁRIO|ARMARIO|ESTANTE|ARQUIVO|GAVETEIRO|CÔMODA|COMODA|GUARDA/.test(hay)) return "ARMÁRIO";
  if (/NOTEBOOK/.test(hay)) return "NOTEBOOK";
  if (/TABLET/.test(hay)) return "TABLET";
  if (/MONITOR/.test(hay)) return "MONITOR";
  if (/IMPRESSORA|MULTIFUNCIONAL/.test(hay)) return "IMPRESSORA";
  if (/COMPUTADOR|DESKTOP|CPU|PRODESK/.test(hay)) return "COMPUTADOR";
  if (/TELEVISOR|SMART TV|\bTV\b/.test(hay)) return "TELEVISOR";
  if (/PROJETOR/.test(hay)) return "PROJETOR";
  if (/TELA DE PROJE/.test(hay)) return "TELA";
  if (/CAIXA DE SOM|AMPLIF/.test(hay)) return "CAIXA DE SOM";
  if (/AR[- ]?CONDICIONADO|SPLIT/.test(hay)) return "AR CONDICIONADO";
  if (/VENTILADOR/.test(hay)) return "VENTILADOR";
  if (/BEBEDOURO/.test(hay)) return "BEBEDOURO";
  if (/PURIFICADOR/.test(hay)) return "PURIFICADOR";
  if (/GELADEIRA|REFRIGERADOR|FRIGOBAR|FREEZER/.test(hay)) return "GELADEIRA";
  if (/FOGÃO|FOGAO/.test(hay)) return "FOGÃO";
  if (/ESTABILIZADOR/.test(hay)) return "ESTABILIZADOR";
  if (/NOBREAK/.test(hay)) return "NOBREAK";
  if (/SWITCH|HUB|ROTEADOR|MODEM|RACK DE REDE/.test(hay)) return "SWITCH";
  if (/CÂMERA|CAMERA|CFTV/.test(hay)) return "CÂMERA";
  if (/RELÓGIO DE PONTO|RELOGIO DE PONTO|PONTO ELETR/.test(hay)) return "RELÓGIO DE PONTO";
  if (/TELEFONE|TELEFÔNICO|TELEFONICO/.test(hay)) return "TELEFONE";
  if (/QUADRO/.test(hay)) return "QUADRO";
  if (/CAVALETE|FLIP/.test(hay)) return "CAVALETE";
  if (/MURAL|CORTIÇA|CORTICA/.test(hay)) return "MURAL";
  if (/VEÍCULO|VEICULO|AUTOMOTOR/.test(hay)) return "VEÍCULO";
  if (/INFORMÁTICA|INFORMATICA/.test(cat)) return "INFORMÁTICA";
  if (/CLIMATIZA/.test(cat)) return "CLIMATIZAÇÃO";
  if (/COPA|COZINHA|REFEITÓRIO|REFEITORIO/.test(cat)) return "COZINHA";
  return (desc.split(/\s+/)[0] || "ITEM").slice(0, 40);
}

function readIdInterno(row) {
  if (row?.id_interno) return String(row.id_interno);
  const ex = row?.extras;
  if (ex && typeof ex === "object" && !Array.isArray(ex) && ex.idInterno) return String(ex.idInterno);
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
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await fn(items[idx]);
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 10) console.warn("Falha:", e?.message || e);
      }
      if ((ok + fail) % 250 === 0 || ok + fail === items.length) {
        console.log(`  progresso ${ok + fail}/${items.length} (ok=${ok} fail=${fail})`);
      }
    }
  });
  await Promise.all(workers);
  return { ok, fail };
}

function loadXlsxRows() {
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

async function main() {
  console.log(APPLY ? ">>> MODO APPLY" : ">>> DRY-RUN");
  console.log("XLSX:", XLSX_PATH);

  const xrows = loadXlsxRows();
  console.log("Linhas planilha:", xrows.length);

  const [invRows, manRows] = await Promise.all([
    fetchAll("inventario", "patrimonio_id, descricao_edit, especie_edit, marca, extras, is_manual"),
    fetchAll("manuais", "id, descricao, especie, marca, extras"),
  ]);
  console.log(`inventario=${invRows.length} manuais=${manRows.length}`);

  const invByInterno = new Map();
  for (const r of invRows) {
    const iid = readIdInterno(r);
    if (iid) invByInterno.set(iid, r);
  }
  const manById = new Map(manRows.map((r) => [String(r.id), r]));

  const updates = [];
  let missing = 0;
  let descN = 0;
  let marcaN = 0;
  let reclassN = 0;

  for (const row of xrows) {
    const idInterno = String(row["ID interno"] || "").trim();
    if (!idInterno) {
      missing++;
      continue;
    }
    const inv = invByInterno.get(idInterno);
    if (!inv) {
      missing++;
      continue;
    }

    const categoria = String(row.Categoria || "").trim();
    const subcategoria = String(row.Subcategoria || "").trim();
    const descPad = String(row["Descrição padronizada"] || "").trim();
    const descOrig = String(row["Descrição original"] || "").trim();
    const marcaNova = cleanMarca(row.Marca);
    const descChanged = yes(row["Descrição revisada?"]) || (descPad && descPad !== descOrig);
    const marcaChanged = yes(row["Marca corrigida?"]);
    const reclass = yes(row["Reclassificado?"]);
    if (descChanged) descN++;
    if (marcaChanged) marcaN++;
    if (reclass) reclassN++;

    const especie = especieFromCategoria(categoria, subcategoria, descPad || descOrig);
    const prevExtras = inv.extras && typeof inv.extras === "object" ? { ...inv.extras } : {};
    const extras = {
      ...prevExtras,
      idInterno,
      categoria,
      subcategoria,
    };

    const patch = {
      patrimonio_id: inv.patrimonio_id,
      extras,
      especie_edit: especie,
    };
    if (descChanged && descPad) patch.descricao_edit = descPad;
    if (marcaChanged) patch.marca = marcaNova;

    const man = manById.get(String(inv.patrimonio_id));
    let manPatch = null;
    if (man) {
      const manExtras = {
        ...(man.extras && typeof man.extras === "object" ? man.extras : {}),
        idInterno,
        categoria,
        subcategoria,
      };
      manPatch = {
        id: man.id,
        extras: manExtras,
        especie,
      };
      if (descChanged && descPad) manPatch.descricao = descPad;
      if (marcaChanged) manPatch.marca = marcaNova;
    }

    updates.push({
      idInterno,
      patrimonio_id: inv.patrimonio_id,
      patch,
      manPatch,
      flags: { descChanged, marcaChanged, reclass, categoria, subcategoria },
    });
  }

  console.log("\n=== RESUMO ===");
  console.log("Updates:", updates.length);
  console.log("Sem match ID:", missing);
  console.log("Descrição a gravar:", descN);
  console.log("Marca a gravar:", marcaN);
  console.log("Reclassificados:", reclassN);
  console.log("Amostra:");
  for (const u of updates.filter((x) => x.flags.descChanged || x.flags.marcaChanged).slice(0, 5)) {
    console.log(
      `  ${u.patrimonio_id} | ${u.flags.categoria} / ${u.flags.subcategoria}`,
      u.patch.descricao_edit ? `| desc→ ${u.patch.descricao_edit}` : "",
      u.patch.marca !== undefined ? `| marca→ ${u.patch.marca || "(vazia)"}` : ""
    );
  }

  if (!APPLY) {
    console.log("\nDry-run ok. Rode com --apply para gravar.");
    return;
  }

  console.log("\nGravando inventario...");
  const invRes = await mapPool(updates, CONCURRENCY, async (u) => {
    const body = {
      extras: u.patch.extras,
      especie_edit: u.patch.especie_edit,
    };
    if (u.patch.descricao_edit !== undefined) body.descricao_edit = u.patch.descricao_edit;
    if (u.patch.marca !== undefined) body.marca = u.patch.marca;
    const { error } = await sb.from("inventario").update(body).eq("patrimonio_id", u.patrimonio_id);
    if (error) throw new Error(`inv ${u.patrimonio_id}: ${error.message}`);
  });

  const manUpdates = updates.filter((u) => u.manPatch);
  console.log("Gravando manuais...", manUpdates.length);
  const manRes = await mapPool(manUpdates, CONCURRENCY, async (u) => {
    const body = {
      extras: u.manPatch.extras,
      especie: u.manPatch.especie,
    };
    if (u.manPatch.descricao !== undefined) body.descricao = u.manPatch.descricao;
    if (u.manPatch.marca !== undefined) body.marca = u.manPatch.marca;
    const { error } = await sb.from("manuais").update(body).eq("id", u.manPatch.id);
    if (error) throw new Error(`man ${u.manPatch.id}: ${error.message}`);
  });

  console.log(`\nConcluído inventario ok=${invRes.ok} fail=${invRes.fail}`);
  console.log(`Concluído manuais ok=${manRes.ok} fail=${manRes.fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
