/**
 * Proxy servidor: baixa foto do Firebase Storage (sem CORS) e chama Gemini.
 * Env: GEMINI_API_KEY ou VITE_GEMINI_API_KEY
 */
const MODEL = process.env.VITE_GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash";

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
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

function isAllowedFotoUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host === "firebasestorage.googleapis.com" ||
      host.endsWith(".firebasestorage.app") ||
      host === "storage.googleapis.com"
    );
  } catch {
    return false;
  }
}

async function fetchImageAsInlineData(url) {
  const src = String(url || "").trim();
  if (!isAllowedFotoUrl(src)) throw new Error("URL de foto não permitida");
  const r = await fetch(src, { redirect: "follow" });
  if (!r.ok) throw new Error(`Falha ao baixar foto (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 32) throw new Error("Foto inválida");
  if (buf.length > 4 * 1024 * 1024) throw new Error("Foto muito grande (máx. ~4 MB)");
  // REST da Gemini usa camelCase (inlineData / mimeType).
  return {
    mimeType: guessMime(src, r.headers.get("content-type")),
    data: buf.toString("base64"),
  };
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

function limparNome(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  t = t.replace(/^["'“”]|["'“”]$/g, "").trim();
  t = t.replace(/^(nome|descri[cç][aã]o|sugest[aã]o)\s*:\s*/i, "").trim();
  t = t.replace(/:\s*$/, "").trim();
  return t.slice(0, 160);
}

function isNomeLixo(nome) {
  const t = String(nome || "").trim().toLowerCase();
  if (!t || t.length < 4) return true;
  if (/here is|json requested|the json|as requested|sure[,!]|i'?m (sorry|unable)|cannot (help|analyze)/i.test(t)) {
    return true;
  }
  if (/^\s*\{/.test(t) || t.includes('"nome"')) return true;
  // Nome patrimonial quase sempre tem letra com acento ou palavra PT — mas permite sem acento.
  // Rejeita se parece frase-meta em inglês (muitas palavras tipicamente EN).
  const en = (t.match(/\b(the|is|json|requested|here|please|following|response)\b/g) || []).length;
  return en >= 2;
}

function parseNomeEspecie(rawText) {
  let raw = String(rawText || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const obj = JSON.parse(m[0]);
      const nome = limparNome(obj.nome || obj.descricao || obj.name || "");
      const especie = String(obj.especie || obj.species || obj.tipo || "").trim();
      if (nome && !isNomeLixo(nome)) return { nome, especie };
    } catch {
      /* fallthrough */
    }
  }
  const nome = limparNome(raw);
  if (isNomeLixo(nome)) return { nome: "", especie: "" };
  return { nome, especie: "" };
}

function matchEspecieCatalogo(sugerida, especies = []) {
  const raw = String(sugerida || "").trim();
  if (!raw) return "";
  if (isNomeLixo(raw) || /^(here|json|requested)$/i.test(raw)) return "";
  const alvo = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  let best = "";
  for (const sp of especies || []) {
    const s = String(sp || "").trim();
    if (!s) continue;
    const n = s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (n === alvo) return s;
    if (alvo.includes(n) || n.includes(alvo)) {
      if (s.length > best.length) best = s;
    }
  }
  return best || raw.toUpperCase().slice(0, 40);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY / VITE_GEMINI_API_KEY não configurada na Vercel" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const fotoUrls = (Array.isArray(body.fotoUrls) ? body.fotoUrls : []).filter(Boolean).slice(0, 2);
    if (!fotoUrls.length) {
      res.status(400).json({ error: "Envie fotoUrls" });
      return;
    }

    const inlineParts = [];
    let lastErr = null;
    for (const url of fotoUrls) {
      try {
        inlineParts.push({ inlineData: await fetchImageAsInlineData(url) });
      } catch (e) {
        lastErr = e;
      }
    }
    if (!inlineParts.length) {
      res.status(400).json({ error: lastErr?.message || "Não foi possível baixar a foto" });
      return;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt({
                especie: body.especie || "",
                nomeAtual: body.nomeAtual || "",
                marca: body.marca || "",
                especies: body.especies || [],
              }),
            },
            ...inlineParts,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify(geminiBody),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `Gemini HTTP ${r.status}`;
      res.status(r.status === 429 ? 429 : 502).json({ error: msg });
      return;
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const raw = parts.map((p) => p?.text || "").join(" ").trim();
    const parsed = parseNomeEspecie(raw);
    if (!parsed.nome || isNomeLixo(parsed.nome)) {
      res.status(502).json({
        error: "A IA não analisou a foto corretamente. Tente novamente.",
        debug: String(raw || "").slice(0, 120),
      });
      return;
    }
    const especie = matchEspecieCatalogo(parsed.especie, body.especies || []);
    res.status(200).json({
      nome: parsed.nome,
      especie,
      model: MODEL,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Erro interno na IA" });
  }
}
