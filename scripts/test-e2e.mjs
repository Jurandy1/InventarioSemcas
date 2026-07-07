/**
 * Teste E2E: Firebase Auth + Supabase dados (mesmo fluxo do app).
 * Uso: TEST_EMAIL=... TEST_PASSWORD=... node scripts/test-e2e.mjs
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

const EMAIL = process.env.TEST_EMAIL || "";
const PASSWORD = process.env.TEST_PASSWORD || "";
const FB_KEY = process.env.VITE_FB_API_KEY;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SITE = process.env.TEST_SITE || "https://inventario-semcas.vercel.app/";

const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function main() {
  console.log("\n=== Teste automático InventarioSemcas ===\n");

  if (!EMAIL || !PASSWORD) {
    fail("Credenciais", "Defina TEST_EMAIL e TEST_PASSWORD");
    process.exit(1);
  }

  // 1. Site no ar
  try {
    const r = await fetch(SITE);
    if (r.ok) pass("Site Vercel", `HTTP ${r.status}`);
    else fail("Site Vercel", `HTTP ${r.status}`);
  } catch (e) {
    fail("Site Vercel", e.message);
  }

  // 2. Firebase login
  let token, uid, email;
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
      }
    );
    const d = await r.json();
    if (d.error) {
      fail("Firebase login", d.error.message);
      printSummary();
      process.exit(1);
    }
    token = d.idToken;
    uid = d.localId;
    email = d.email;
    pass("Firebase login", `${email} (uid: ${uid.slice(0, 8)}…)`);
  } catch (e) {
    fail("Firebase login", e.message);
    printSummary();
    process.exit(1);
  }

  // 3. JWT role claim (Supabase)
  const claims = decodeJwt(token);
  if (claims?.role === "authenticated") {
    pass("JWT role claim", "role=authenticated");
  } else {
    fail("JWT role claim", `role=${claims?.role ?? "ausente"} — faça logout/login ou rode set-role-claim`);
  }

  // 4. Supabase client com token Firebase
  const sb = createClient(SB_URL, SB_ANON, {
    accessToken: async () => token,
  });

  const tables = [
    { name: "inventario", label: "Inventário" },
    { name: "manuais", label: "Manuais" },
    { name: "locais", label: "Locais" },
    { name: "inventariantes", label: "Inventariantes" },
    { name: "campanhas", label: "Campanhas" },
  ];

  for (const { name, label } of tables) {
    const { data, error, count } = await sb.from(name).select("*", { count: "exact", head: false }).limit(5);
    if (error) {
      fail(`Supabase leitura: ${label}`, error.message);
    } else {
      const total = count ?? data?.length ?? 0;
      pass(`Supabase leitura: ${label}`, `${total} registro(s) no total, amostra ${data?.length ?? 0}`);
    }
  }

  // 5. Perfil do usuário logado
  const { data: inv, error: invErr } = await sb.from("inventariantes").select("*").eq("uid", uid).maybeSingle();
  if (invErr) {
    fail("Perfil inventariante", invErr.message);
  } else if (inv) {
    pass("Perfil inventariante", `${inv.nome || inv.email} — status: ${inv.status}`);
  } else {
    const { data: coord } = await sb.from("coordenadores").select("*").eq("uid", uid).maybeSingle();
    if (coord) pass("Perfil coordenador", `${coord.nome} — status: ${coord.status}`);
    else pass("Perfil", "admin ou sem registro em inventariantes (pode ser admin Firebase)");
  }

  // 6. Escrita de teste (upsert + delete) — inventario fictício
  const testId = `TEST_AUTO_${Date.now()}`;
  const testRow = {
    patrimonio_id: testId,
    unidade_id: "u_test",
    unidade_nome: "Teste automático",
    estado: "Bom",
    situacao: "Em uso",
    obs: "Registro de teste E2E — pode apagar",
    ultima_atualizacao: new Date().toISOString(),
    foto_urls: [],
  };

  const { error: writeErr } = await sb.from("inventario").upsert(testRow);
  if (writeErr) {
    fail("Supabase escrita (teste)", writeErr.message);
  } else {
    pass("Supabase escrita (teste)", `upsert ${testId}`);
    const { error: delErr } = await sb.from("inventario").delete().eq("patrimonio_id", testId);
    if (delErr) fail("Supabase delete (teste)", delErr.message);
    else pass("Supabase delete (teste)", "registro de teste removido");
  }

  // 7. Bundle produção contém Supabase + Firebase (chunks lazy-loaded)
  try {
    const html = await (await fetch(SITE)).text();
    const assets = new Set([...html.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0]));
    const idx = [...assets].find((a) => a.startsWith("assets/index-"));
    if (idx) {
      const idxJs = await (await fetch(SITE + idx)).text();
      for (const m of idxJs.matchAll(/assets\/[^"']+\.js/g)) assets.add(m[0]);
    }
    let blob = "";
    for (const a of assets) blob += await (await fetch(SITE + a)).text();
    const hasSb = blob.includes("kjywmxhwphkhudzswwus") || blob.includes("createClient");
    const hasFb = /AIzaSy/.test(blob);
    if (hasSb && hasFb) pass("Bundle Vercel", `${assets.size} chunks — Firebase + Supabase`);
    else fail("Bundle Vercel", `supabase=${hasSb} firebase=${hasFb}`);
  } catch (e) {
    fail("Bundle Vercel", e.message);
  }

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n=== Resumo: ${ok} OK, ${bad} falha(s) ===\n`);
}

main();
