/**
 * Gemini (visão) — nome + espécie a partir da foto.
 * Em produção chama /api/gemini-nome (proxy Vercel) para evitar CORS do Firebase Storage.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function isGeminiNomeConfigured() {
  if (import.meta.env.PROD) return true;
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
  // REST Gemini: camelCase (inlineData / mimeType)
  return { mimeType: guessMime(src, blob.type), data: btoa(binary) };
}

function normKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function isNomeLixo(nome) {
  const t = String(nome || "").trim().toLowerCase();
  if (!t || t.length < 4) return true;
  if (/here is|json requested|the json|as requested|sure[,!]|i'?m (sorry|unable)|cannot (help|analyze)/i.test(t)) {
    return true;
  }
  if (/^\s*\{/.test(t) || t.includes('"nome"')) return true;
  const en = (t.match(/\b(the|is|json|requested|here|please|following|response)\b/g) || []).length;
  return en >= 2;
}

export function matchEspecieCatalogo(sugerida, especies = []) {
  const raw = String(sugerida || "").trim();
  if (!raw) return "";
  if (isNomeLixo(raw) || /^(here|json|requested)$/i.test(raw)) return "";
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
    "Analise a imagem do bem patrimonial. Responda APENAS JSON puro, sem markdown e sem texto fora do JSON.",
    'Formato obrigatório: {"nome":"Descrição em português","especie":"ESPÉCIE"}',
    "",
    "nome: 3 a 12 palavras em português do Brasil (ex.: Cadeira de plástico com braço).",
    "Inclua material/cor/atributos visíveis. Sem abreviações (c/, s/). Sem marca, tombo ou local.",
    "especie: UMA palavra em MAIÚSCULAS (CADEIRA, MESA, ARMARIO…).",
    catalogo ? `Prefira espécie desta lista: ${catalogo}.` : "",
    `Espécie atual: ${esp}. Nome atual: ${atual}.${mk ? ` Marca: ${mk}.` : ""}`,
    "PROIBIDO responder em inglês ou frases como 'here is the json'.",
  ]
    .filter(Boolean)
    .join("\n");
}

function limparRespostaNome(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  t = t.replace(/^["'“”]|["'“”]$/g, "").trim();
  t = t.replace(/^(nome|descri[cç][aã]o|sugest[aã]o)\s*:\s*/i, "").trim();
  t = t.replace(/:\s*$/, "").trim();
  return t.slice(0, 160);
}

function parseNomeEspecie(rawText) {
  let raw = String(rawText || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const obj = JSON.parse(m[0]);
      const nome = limparRespostaNome(obj.nome || obj.descricao || obj.name || "");
      const especie = String(obj.especie || obj.species || obj.tipo || "").trim();
      if (nome && !isNomeLixo(nome)) return { nome, especie };
    } catch {
      /* fallback */
    }
  }
  const nome = limparRespostaNome(raw);
  if (isNomeLixo(nome)) return { nome: "", especie: "" };
  return { nome, especie: "" };
}

async function viaServerProxy(payload) {
  const r = await fetch("/api/gemini-nome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error || `Falha no proxy IA (HTTP ${r.status})`);
  }
  if (!data?.nome || isNomeLixo(data.nome)) {
    throw new Error(data?.error || "A IA não analisou a foto corretamente. Tente novamente.");
  }
  return {
    nome: String(data.nome),
    especie: matchEspecieCatalogo(data.especie || "", payload.especies || []),
    model: data.model || MODEL,
  };
}

async function viaClientDirect({ fotoUrls, especie, nomeAtual, marca, especies }) {
  if (!API_KEY) {
    throw new Error("Gemini não configurado (VITE_GEMINI_API_KEY).");
  }
  const urls = (Array.isArray(fotoUrls) ? fotoUrls : []).filter(Boolean).slice(0, 2);
  if (!urls.length) throw new Error("Selecione itens que tenham foto");

  const inlineParts = [];
  let lastErr = null;
  for (const url of urls) {
    try {
      inlineParts.push({ inlineData: await fetchImageAsInlineData(url) });
    } catch (e) {
      lastErr = e;
    }
  }
  if (!inlineParts.length) {
    const msg = String(lastErr?.message || "");
    if (/failed to fetch|networkerror|cors|access-control/i.test(msg) || lastErr?.name === "TypeError") {
      throw new Error("CORS bloqueou a foto no navegador. Use o app na Vercel (proxy /api/gemini-nome).");
    }
    throw new Error(lastErr?.message || "Não foi possível ler a foto");
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt({ especie, nomeAtual, marca, especies }) }, ...inlineParts],
      },
    ],
    generationConfig: {
      temperature: 0.1,
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
    if (r.status === 429 || /quota|rate.?limit|exceeded/i.test(msg)) {
      throw new Error(
        "Cota da Gemini esgotada. Aguarde ~1 minuto ou ative faturamento no Google AI Studio. " +
          "Opcional: VITE_GEMINI_MODEL=gemini-flash-latest na Vercel."
      );
    }
    if (r.status === 403 || r.status === 401) throw new Error("Chave Gemini inválida ou sem permissão.");
    throw new Error(msg);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const raw = parts.map((p) => p?.text || "").join(" ").trim();
  const parsed = parseNomeEspecie(raw);
  if (!parsed.nome || isNomeLixo(parsed.nome)) {
    throw new Error("A IA não analisou a foto corretamente. Tente novamente.");
  }
  return {
    nome: parsed.nome,
    especie: matchEspecieCatalogo(parsed.especie, especies),
    model: MODEL,
  };
}

export async function sugerirNomeComGemini({
  fotoUrls = [],
  especie = "",
  nomeAtual = "",
  marca = "",
  especies = [],
} = {}) {
  const payload = { fotoUrls, especie, nomeAtual, marca, especies };

  try {
    return await viaServerProxy(payload);
  } catch (proxyErr) {
    if (import.meta.env.PROD) throw proxyErr;
    try {
      return await viaClientDirect(payload);
    } catch (clientErr) {
      throw new Error(
        `${proxyErr?.message || "Proxy IA indisponível"}. Fallback local: ${clientErr?.message || clientErr}`
      );
    }
  }
}
