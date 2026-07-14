/**
 * Gemini (visão) para sugerir nome + espécie a partir da foto do item.
 * A chave fica em VITE_GEMINI_API_KEY (nunca no código).
 *
 * Atenção: em app estático a chave aparece no bundle do browser.
 * Restrinja a chave por HTTP referrer no Google AI Studio / Cloud Console.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function isGeminiNomeConfigured() {
  return Boolean(String(API_KEY || "").trim());
}

function guessMime(url, contentType) {
  const ct = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (ct.startsWith("image/")) return ct;
  const path = String(url || "").toLowerCase();
  if (path.includes(".png")) return "image/png";
  if (path.includes(".webp")) return "image/webp";
  if (path.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchImageAsInlineData(url) {
  const src = String(url || "").trim();
  if (!src) throw new Error("Item sem foto");
  const r = await fetch(src);
  if (!r.ok) throw new Error(`Não foi possível baixar a foto (HTTP ${r.status})`);
  const blob = await r.blob();
  if (!blob || blob.size < 32) throw new Error("Foto inválida ou vazia");
  if (blob.size > 4 * 1024 * 1024) {
    throw new Error("Foto muito grande para a IA (máx. ~4 MB). Use uma foto menor.");
  }
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const data = btoa(binary);
  return { mime_type: guessMime(src, blob.type), data };
}

function normKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Alinha espécie da IA à lista oficial (planilha) quando possível. */
export function matchEspecieCatalogo(sugerida, especies = []) {
  const raw = String(sugerida || "").trim();
  if (!raw) return "";
  const alvo = normKey(raw);
  if (!alvo) return "";
  let best = "";
  for (const sp of especies || []) {
    const s = String(sp || "").trim();
    if (!s) continue;
    if (normKey(s) === alvo) return s;
    if (alvo.includes(normKey(s)) || normKey(s).includes(alvo)) {
      if (s.length > best.length) best = s;
    }
  }
  if (best) return best;
  // Padrão patrimonial: espécie em MAIÚSCULAS
  return raw.toUpperCase().slice(0, 40);
}

function buildPrompt({ especie, nomeAtual, marca, especies = [] }) {
  const esp = String(especie || "").trim() || "não informada";
  const atual = String(nomeAtual || "").trim() || "(sem nome)";
  const mk = String(marca || "").trim();
  const catalogo = [...new Set((especies || []).map((e) => String(e || "").trim()).filter(Boolean))]
    .slice(0, 80)
    .join(", ");
  return [
    "Você auxilia inventário patrimonial da SEMCAS (mobiliário e equipamentos de unidades públicas).",
    "Analise a foto e diga o nome padronizado E a espécie correta do bem.",
    "",
    "Responda SOMENTE um JSON válido nesta forma exata (sem markdown, sem texto extra):",
    '{"nome":"...","especie":"..."}',
    "",
    "Regras do campo nome:",
    "- 3 a 12 palavras em português do Brasil, objetiva.",
    "- Inclua atributos visíveis: material, cor, com/sem braço, com/sem rodinha etc.",
    "- NÃO invente marca, tombo, local ou estado.",
    "- NÃO use abreviações (c/, s/, p/).",
    "- Capitalize como título (artigos em minúsculas).",
    "",
    "Regras do campo especie:",
    "- Uma palavra-classe do bem em MAIÚSCULAS (ex.: CADEIRA, MESA, ARMARIO, GELADEIRA, NOTEBOOK).",
    catalogo
      ? `- Prefira EXATAMENTE uma destas espécies já usadas no inventário: ${catalogo}.`
      : "- Use o termo patrimonial mais comum para o tipo do objeto.",
    `- Espécie atual no cadastro: ${esp}.`,
    `- Nome digitado hoje: ${atual}.`,
    mk ? `- Marca conhecida (não coloque a marca na espécie): ${mk}.` : "- Marca: não informada.",
  ].join("\n");
}

function limparRespostaNome(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  t = t.replace(/^["'“”]|["'“”]$/g, "").trim();
  t = t.replace(/^(nome|descri[cç][aã]o|sugest[aã]o)\s*:\s*/i, "").trim();
  return t.slice(0, 160);
}

function parseNomeEspecie(rawText) {
  let raw = String(rawText || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();

  // JSON completo
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const obj = JSON.parse(m[0]);
      const nome = limparRespostaNome(obj.nome || obj.descricao || obj.name || "");
      const especie = String(obj.especie || obj.species || obj.tipo || "").trim();
      if (nome) return { nome, especie };
    } catch {
      /* fallback abaixo */
    }
  }

  // "nome | especie" ou duas linhas
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { nome: limparRespostaNome(lines[0]), especie: lines[1].replace(/^especie\s*:\s*/i, "").trim() };
  }
  const pipe = raw.split("|").map((p) => p.trim());
  if (pipe.length >= 2) {
    return { nome: limparRespostaNome(pipe[0]), especie: pipe[1] };
  }
  return { nome: limparRespostaNome(raw), especie: "" };
}

/**
 * Analisa foto e sugere nome + espécie.
 * @returns {Promise<{ nome: string, especie: string, model: string }>}
 */
export async function sugerirNomeComGemini({
  fotoUrls = [],
  especie = "",
  nomeAtual = "",
  marca = "",
  especies = [],
} = {}) {
  if (!isGeminiNomeConfigured()) {
    throw new Error(
      "Gemini não configurado. Defina VITE_GEMINI_API_KEY no .env e nas Environment Variables da Vercel."
    );
  }
  const urls = (Array.isArray(fotoUrls) ? fotoUrls : []).filter(Boolean).slice(0, 2);
  if (!urls.length) throw new Error("Selecione itens que tenham foto");

  const inlineParts = [];
  let lastErr = null;
  for (const url of urls) {
    try {
      inlineParts.push({ inline_data: await fetchImageAsInlineData(url) });
    } catch (e) {
      lastErr = e;
    }
  }
  if (!inlineParts.length) {
    throw new Error(lastErr?.message || "Não foi possível ler a foto (CORS ou URL inválida)");
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt({ especie, nomeAtual, marca, especies }) }, ...inlineParts],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    },
  };

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": API_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${r.status}`;
    if (r.status === 429) throw new Error("Limite da API Gemini atingido. Tente de novo em instantes.");
    if (r.status === 403 || r.status === 401) throw new Error("Chave Gemini inválida ou sem permissão.");
    throw new Error(msg);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const raw = parts.map((p) => p?.text || "").join(" ").trim();
  const parsed = parseNomeEspecie(raw);
  if (!parsed.nome) throw new Error("A IA não retornou um nome utilizável");
  const especieFinal = matchEspecieCatalogo(parsed.especie, especies);
  return { nome: parsed.nome, especie: especieFinal, model: MODEL };
}
