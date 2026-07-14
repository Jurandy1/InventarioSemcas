/**
 * Gemini (visão) para sugerir nome padronizado a partir da foto do item.
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
  // Limita ~4MB para a API
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

function buildPrompt({ especie, nomeAtual, marca }) {
  const esp = String(especie || "").trim() || "não informada";
  const atual = String(nomeAtual || "").trim() || "(sem nome)";
  const mk = String(marca || "").trim();
  return [
    "Você auxilia inventário patrimonial da SEMCAS (mobiliário e equipamentos de unidades públicas).",
    "Analise a foto e proponha UMA descrição padronizada em português do Brasil para o bem.",
    "",
    "Regras:",
    "- Responda SOMENTE com o nome/descrição final, sem aspas, sem markdown, sem explicação.",
    "- 3 a 12 palavras, clara e objetiva (ex.: Cadeira de plástico sem braço).",
    "- Inclua atributos visíveis úteis: material, cor, com/sem braço, com/sem rodinha, medidas óbvias.",
    "- NÃO invente marca, número de patrimônio, local ou estado de conservação.",
    "- NÃO use abreviações (evite c/, s/, p/).",
    "- Capitalize como título em português (primeira palavra e nomes; artigos em minúsculas).",
    `- Espécie sugerida/atual: ${esp}.`,
    `- Nome digitado hoje: ${atual}.`,
    mk ? `- Marca conhecida (não misture a marca na descrição se não for essencial): ${mk}.` : "- Marca: não informada.",
  ].join("\n");
}

function limparRespostaNome(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```[\s\S]*?\n/, "").replace(/```$/g, "").trim();
  t = t.split("\n").map((l) => l.trim()).filter(Boolean)[0] || t;
  t = t.replace(/^["'“”]|["'“”]$/g, "").trim();
  t = t.replace(/^\*{1,2}|\*{1,2}$/g, "").trim();
  // remove prefixos tipo "Nome:" / "Sugestão:"
  t = t.replace(/^(nome|descri[cç][aã]o|sugest[aã]o)\s*:\s*/i, "").trim();
  return t.slice(0, 160);
}

/**
 * Sugere nome padronizado olhando a(s) foto(s) do item.
 * @returns {Promise<{ nome: string, model: string }>}
 */
export async function sugerirNomeComGemini({
  fotoUrls = [],
  especie = "",
  nomeAtual = "",
  marca = "",
} = {}) {
  if (!isGeminiNomeConfigured()) {
    throw new Error(
      "Gemini não configurado. Defina VITE_GEMINI_API_KEY no .env (local) e no secret do GitHub/Vercel."
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
        parts: [{ text: buildPrompt({ especie, nomeAtual, marca }) }, ...inlineParts],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 128,
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
  const nome = limparRespostaNome(raw);
  if (!nome) throw new Error("A IA não retornou um nome utilizável");
  return { nome, model: MODEL };
}
