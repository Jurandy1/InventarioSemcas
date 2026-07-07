/**
 * Testa cadastro de item manual (manuais + inventario) como o App.jsx faz.
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

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const FB_KEY = process.env.VITE_FB_API_KEY;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY;

async function login() {
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
  return d.idToken;
}

function manualItem() {
  const id = `MAN_TEST_${Date.now()}`;
  return {
    id,
    patrimonioLabel: "99999/TESTE",
    tomboRef: "99999/TESTE",
    data: new Date().toLocaleDateString("pt-BR"),
    especie: "TESTE AUTO",
    descricao: "Item manual teste E2E - apagar",
    marca: "Marca teste",
    fornecedor: "",
    empenho: "",
    nf: "",
    dataNF: "",
    tipoEntrada: "Próprio",
    valor: 0,
    valorAtual: 0,
    isManual: true,
    unidadeId: "u_test_auto",
  };
}

async function main() {
  console.log("\n=== Teste: cadastro item manual ===\n");
  if (!EMAIL || !PASSWORD) {
    console.error("Defina TEST_EMAIL e TEST_PASSWORD no ambiente");
    process.exit(1);
  }

  const token = await login();
  const sb = createClient(SB_URL, SB_ANON, { accessToken: async () => token });

  const item = manualItem();
  const unidadeId = item.unidadeId;

  // 1. Salvar em manuais (como App.jsx)
  const manualRow = {
    id: item.id,
    unidade_id: unidadeId,
    patrimonio_label: item.patrimonioLabel,
    data: item.data,
    especie: item.especie,
    descricao: item.descricao,
    marca: item.marca,
    tipo_entrada: "Próprio",
    valor: 0,
    valor_atual: 0,
  };

  const { error: mErr } = await sb.from("manuais").upsert(manualRow);
  if (mErr) {
    console.error("❌ Falha ao salvar manuais:", mErr.message);
    process.exit(1);
  }
  console.log("✅ manuais salvo:", item.id);

  // 2. Salvar em inventario (como markFound)
  const invRow = {
    patrimonio_id: item.id,
    unidade_id: unidadeId,
    unidade_nome: "Unidade teste",
    estado: "Bom",
    situacao: "Em uso",
    obs: item.descricao,
    marca: item.marca,
    origem: "Próprio",
    foto_urls: [],
    is_manual: true,
    ultima_atualizacao: new Date().toISOString(),
  };

  const { error: iErr } = await sb.from("inventario").upsert(invRow);
  if (iErr) {
    console.error("❌ Falha ao salvar inventario:", iErr.message);
    await sb.from("manuais").delete().eq("id", item.id);
    process.exit(1);
  }
  console.log("✅ inventario salvo:", item.id);

  // 3. Ler de volta (como useUnidades + useFound)
  const { data: mRead, error: mRErr } = await sb.from("manuais").select("*").eq("id", item.id).single();
  const { data: iRead, error: iRErr } = await sb.from("inventario").select("*").eq("patrimonio_id", item.id).single();

  if (mRErr || iRErr) {
    console.error("❌ Falha ao ler:", mRErr?.message || iRErr?.message);
    process.exit(1);
  }

  const okManual =
    mRead.descricao === item.descricao &&
    mRead.unidade_id === unidadeId &&
    mRead.patrimonio_label === item.patrimonioLabel;

  const okInv = iRead.estado === "Bom" && iRead.is_manual === true;

  if (okManual && okInv) {
    console.log("✅ Leitura OK — cadastro de item novo funciona no Supabase");
  } else {
    console.error("❌ Dados lidos não batem:", { okManual, okInv, mRead, iRead });
    process.exit(1);
  }

  // 4. Listar por unidade (como fsGetAll com where)
  const { data: byUnit, error: qErr } = await sb
    .from("manuais")
    .select("id")
    .eq("unidade_id", unidadeId);
  if (qErr) console.error("❌ Query por unidade:", qErr.message);
  else console.log(`✅ Query manuais por unidade: ${byUnit?.length ?? 0} item(ns)`);

  // Limpar
  await sb.from("inventario").delete().eq("patrimonio_id", item.id);
  await sb.from("manuais").delete().eq("id", item.id);
  console.log("✅ Registros de teste removidos\n");
  console.log("=== RESULTADO: cadastro de itens novos está funcionando ===\n");
}

main().catch((e) => {
  console.error("❌ Erro:", e.message);
  process.exit(1);
});
