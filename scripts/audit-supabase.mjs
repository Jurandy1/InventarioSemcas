/**
 * Auditoria profunda: schema, counts, RLS sample, writes por tabela.
 * Uso: TEST_EMAIL=... TEST_PASSWORD=... node scripts/audit-supabase.mjs
 * Não imprime secrets.
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
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE || "";

const EXPECTED_COLS = {
  inventario: [
    "patrimonio_id", "unidade_id", "unidade_nome", "estado", "situacao", "local_id",
    "obs", "marca", "origem", "foto_urls", "data", "hora", "usuario", "email",
    "ultima_atualizacao", "is_manual", "descricao_edit", "especie_edit", "imei",
    "sem_tombo", "tombo_referencia", "permuta_desc", "permuta_marca", "permuta_estado",
    "identificado_por_foto", "extras",
  ],
  manuais: [
    "id", "unidade_id", "patrimonio_label", "data", "especie", "descricao", "marca",
    "fornecedor", "empenho", "nf", "data_nf", "tipo_entrada", "valor", "valor_atual",
    "imei", "extras",
  ],
  locais: ["id", "nome", "unidade_id", "unidade_ids", "criado_por", "criado_em", "desc", "session_id", "extras"],
  inventariantes: [
    "uid", "email", "nome", "matricula", "cargo", "unidade_id", "unidade_ids",
    "unidade_nome", "unidade_nomes", "status", "criado_em", "data_criacao",
    "convite_token", "data_aprovacao", "observacoes", "aprovado_por", "data_rejeicao",
    "motivo_rejeicao", "rejeitado_por", "data_desativacao", "motivo_desativacao",
    "desativado_por", "extras",
  ],
  coordenadores: [
    "uid", "email", "nome", "matricula", "unidade_id", "unidade_ids",
    "unidade_nome", "unidade_nomes", "status", "criado_em", "data_criacao",
    "convite_token", "data_aprovacao", "observacoes", "aprovado_por", "data_rejeicao",
    "motivo_rejeicao", "rejeitada_por", "data_desativacao", "motivo_desativacao",
    "desativada_por", "extras",
  ],
  tombos_ne: ["id", "unidade_id", "descricao", "obs", "usuario", "data", "extras"],
  finalizacoes: [
    "id", "campanha_id", "unidade_ids", "unidade_nomes", "session_id", "finalized_at",
    "finalized_by", "coordenadora", "convite_token", "stats", "status", "ultima_edicao",
    "extras",
  ],
  campanhas: ["id", "status", "dados"],
  auditoria: ["id", "acao", "colecao", "doc_id", "usuario", "uid", "dados", "criado_em"],
  convites: [
    "id", "token", "status", "criado_por", "data_criacao", "data_expiracao", "usado_por",
    "unidade_id", "unidade_nome", "matricula", "data_uso", "extras",
  ],
  convites_inventariantes: [
    "id", "token", "status", "criado_por", "data_criacao", "data_expiracao", "usado_por",
    "unidade_id", "unidade_nome", "extras",
  ],
  cadastro_indice: ["id", "uid", "email", "matricula", "nome", "status", "papel", "chave", "atualizado_em", "extras"],
  presenca_inventario: ["uid", "nome", "email", "unidade_ids", "item_em_edicao", "item_descricao", "atualizado_em", "ultimo_ping", "extras"],
  aprovacoes: ["id", "item_id", "approver_id", "dados"],
  rejeicoes: ["id", "item_id", "approver_id", "dados"],
  backups: ["id", "criado_em", "criado_por", "dados"],
};

const WRITE_SAMPLES = {
  inventario: (id) => ({
    patrimonio_id: id, unidade_id: "u_audit", unidade_nome: "Audit",
    estado: "Bom", situacao: "Em uso", obs: "audit temp", foto_urls: [],
    ultima_atualizacao: new Date().toISOString(), extras: { _audit: true },
  }),
  manuais: (id) => ({
    id, unidade_id: "u_audit", patrimonio_label: id, especie: "Audit",
    descricao: "audit", tipo_entrada: "Próprio", valor: 0, extras: { _audit: true },
  }),
  locais: (id) => ({
    id, nome: "Local audit", unidade_id: "u_audit", unidade_ids: ["u_audit"],
    criado_por: "audit", criado_em: new Date().toISOString(), extras: { _audit: true },
  }),
  tombos_ne: (id) => ({
    id, unidade_id: "u_audit", descricao: "audit", obs: "", usuario: "audit",
    data: new Date().toISOString().slice(0, 10), extras: { _audit: true },
  }),
  auditoria: (id) => ({
    id, acao: "AUDIT_TEST", colecao: "audit", doc_id: id, usuario: "audit",
    uid: "audit", dados: { _audit: true }, criado_em: new Date().toISOString(),
  }),
  campanhas: (id) => ({ id, status: "teste", dados: { _audit: true } }),
  cadastro_indice: (id) => ({
    id, uid: "audit", email: "audit@test.local", matricula: "0", nome: "Audit",
    status: "teste", papel: "audit", chave: "email", atualizado_em: new Date().toISOString(),
    extras: { _audit: true },
  }),
  aprovacoes: (id) => ({ id, item_id: id, approver_id: "audit", dados: { _audit: true } }),
  rejeicoes: (id) => ({ id, item_id: id, approver_id: "audit", dados: { _audit: true } }),
  backups: (id) => ({
    id, criado_em: new Date().toISOString(), criado_por: "audit", dados: { _audit: true },
  }),
  finalizacoes: (id) => ({
    id, campanha_id: "ativa", unidade_ids: ["u_audit"], unidade_nomes: ["Audit"],
    session_id: "audit", finalized_at: new Date().toISOString(),
    finalized_by: { email: "audit" }, coordenadora: {}, stats: {}, status: "teste",
    extras: { _audit: true },
  }),
  convites: (id) => ({
    id, token: id, status: "teste", criado_por: "audit",
    data_criacao: new Date().toISOString(), data_expiracao: new Date().toISOString(),
    extras: { _audit: true },
  }),
  convites_inventariantes: (id) => ({
    id, token: id, status: "teste", criado_por: "audit",
    data_criacao: new Date().toISOString(), data_expiracao: new Date().toISOString(),
    extras: { _audit: true },
  }),
  inventariantes: (id) => ({
    uid: id, email: "audit.inv@test.local", nome: "Audit Inv", matricula: "AUDIT",
    status: "teste", criado_em: new Date().toISOString(), extras: { _audit: true },
  }),
  coordenadores: (id) => ({
    uid: id, email: "audit.coord@test.local", nome: "Audit Coord", matricula: "AUDIT",
    status: "teste", criado_em: new Date().toISOString(), extras: { _audit: true },
  }),
  presenca_inventario: (id) => ({
    uid: id, nome: "Audit", email: "audit@test.local", unidade_ids: ["u_audit"],
    atualizado_em: new Date().toISOString(), extras: { _audit: true },
  }),
};

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}
function warn(name, detail = "") {
  results.push({ ok: true, warn: true, name, detail });
  console.warn(`⚠️  ${name}${detail ? ` — ${detail}` : ""}`);
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

function sampleKeys(row) {
  return Object.keys(row || {}).sort();
}

async function main() {
  console.log("\n=== Auditoria profunda Supabase ===\n");

  if (!EMAIL || !PASSWORD) {
    fail("Credenciais", "Defina TEST_EMAIL e TEST_PASSWORD");
    process.exit(1);
  }
  if (!SB_URL || !SB_ANON) {
    fail("Env", "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes");
    process.exit(1);
  }

  // Env sanity (sem imprimir valores)
  pass("Env Supabase", `URL host ok=${/kjywmxhwphkhudzswwus/.test(SB_URL)} anon_len=${SB_ANON.length} type=${SB_ANON.startsWith("eyJ") ? "jwt" : SB_ANON.startsWith("sb_") ? "sb_key" : "other"}`);
  pass("Env Firebase", `apiKey_len=${(FB_KEY || "").length}`);

  const auth = await firebaseLogin();
  pass("Login Firebase", `${auth.email} uid=${auth.localId.slice(0, 8)}…`);

  const userSb = createClient(SB_URL, SB_ANON, {
    accessToken: async () => auth.idToken,
  });

  const anonSb = createClient(SB_URL, SB_ANON);
  const serviceSb = SERVICE
    ? createClient(SB_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  if (SERVICE) pass("Service role", "disponível para checagens admin");
  else warn("Service role", "não definida — schema via select amostra apenas");

  // 1) Counts + schema columns por tabela
  for (const [table, expected] of Object.entries(EXPECTED_COLS)) {
    const { data, error, count } = await userSb.from(table).select("*", { count: "exact" }).limit(1);
    if (error) {
      fail(`Tabela ${table}`, error.message);
      continue;
    }
    pass(`Tabela ${table}`, `${count ?? "?"} registros`);

    let cols = data?.[0] ? sampleKeys(data[0]) : null;
    if (!cols && serviceSb) {
      // tabela vazia: usa OpenAPI ou insert+select com service
      const probeId = `__schema_probe_${Date.now()}`;
      const maker = WRITE_SAMPLES[table];
      if (maker) {
        const row = maker(probeId);
        const { error: wErr } = await serviceSb.from(table).upsert(row);
        if (!wErr) {
          const { data: d2 } = await serviceSb.from(table).select("*").eq(Object.keys(row)[0], probeId).maybeSingle();
          cols = sampleKeys(d2);
          await serviceSb.from(table).delete().eq(Object.keys(row)[0], probeId);
        }
      }
    }

    if (!cols) {
      warn(`Colunas ${table}`, "sem amostra (tabela vazia) — não comparado");
      continue;
    }

    const missing = expected.filter((c) => !cols.includes(c));
    const extra = cols.filter((c) => !expected.includes(c));
    if (missing.length) fail(`Schema ${table} faltando`, missing.join(", "));
    else pass(`Schema ${table}`, `${cols.length} cols (ok vs app)`);
    if (extra.length) warn(`Schema ${table} extras no banco`, extra.join(", "));
  }

  // 2) Leitura pública (convites / cadastro_indice) sem token
  for (const t of ["convites", "convites_inventariantes", "cadastro_indice"]) {
    const { error } = await anonSb.from(t).select("id").limit(1);
    if (error) fail(`RLS pública SELECT ${t}`, error.message);
    else pass(`RLS pública SELECT ${t}`, "ok");
  }

  // 3) Escrita autenticada em todas as tabelas write-sample + limpeza
  const stamp = Date.now();
  for (const [table, maker] of Object.entries(WRITE_SAMPLES)) {
    const id = `AUDIT_${stamp}_${table}`;
    const row = maker(id);
    const pk = Object.keys(row)[0];
    const { error: wErr } = await userSb.from(table).upsert(row);
    if (wErr) {
      fail(`Write ${table}`, wErr.message);
      continue;
    }
    const { data: readBack, error: rErr } = await userSb.from(table).select("*").eq(pk, id).maybeSingle();
    if (rErr || !readBack) {
      fail(`Readback ${table}`, rErr?.message || "não encontrado após upsert");
    } else {
      pass(`Write+read ${table}`, "ok");
    }
    const { error: dErr } = await userSb.from(table).delete().eq(pk, id);
    if (dErr) fail(`Delete ${table}`, dErr.message);
    else pass(`Delete ${table}`, "limpo");
  }

  // 4) Amostra de qualidade dos dados reais
  const { data: invSample } = await userSb
    .from("inventario")
    .select("patrimonio_id,unidade_id,foto_urls,ultima_atualizacao,estado,situacao,is_manual")
    .order("ultima_atualizacao", { ascending: false })
    .limit(20);

  if (invSample?.length) {
    const withFoto = invSample.filter((r) => Array.isArray(r.foto_urls) && r.foto_urls.length > 0).length;
    const withUnidade = invSample.filter((r) => r.unidade_id).length;
    const withEstado = invSample.filter((r) => r.estado).length;
    pass(
      "Qualidade inventario (20 recentes)",
      `unidade=${withUnidade}/20 estado=${withEstado}/20 fotos=${withFoto}/20`
    );
  }

  const { data: locais } = await userSb.from("locais").select("id,nome,unidade_id,unidade_ids").limit(50);
  if (locais) {
    const orphan = locais.filter((l) => !l.unidade_id && !(Array.isArray(l.unidade_ids) && l.unidade_ids.length)).length;
    if (orphan) warn("Locais sem unidade", `${orphan}/${locais.length} na amostra`);
    else pass("Locais com unidade", `${locais.length} ok`);
  }

  const { count: finCount } = await userSb.from("finalizacoes").select("*", { count: "exact", head: true });
  pass("Finalizações", `${finCount ?? 0} registros`);

  const { data: camp } = await userSb.from("campanhas").select("*").limit(5);
  if (camp?.length) pass("Campanha ativa", camp.map((c) => `${c.id}:${c.status}`).join(", "));
  else warn("Campanhas", "nenhuma campanha encontrada");

  // 5) Admin uid vs tabela
  const adminUid = "fC7cWAbUKEY7wGMHdN9z9dcdvX03";
  if (auth.localId === adminUid) pass("Usuário é ADMIN_UID", "acesso total esperado");
  else warn("Usuário não é admin", `uid logado ≠ ADMIN_UID`);

  // summary
  const ok = results.filter((r) => r.ok && !r.warn).length;
  const warns = results.filter((r) => r.warn).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n=== Resumo: ${ok} OK, ${warns} avisos, ${bad} falha(s) ===\n`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
