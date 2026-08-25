/**
 * Proxy: baixa foto do Firebase Storage no servidor (sem CORS do navegador).
 * GET /api/foto-proxy?url=...  → bytes da imagem
 * POST { url } → { mimeType, data } base64
 */

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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

async function downloadFoto(url, authHeader) {
  const src = String(url || "").trim();
  if (!isAllowedFotoUrl(src)) throw new Error("URL de foto não permitida");

  const headers = {};
  if (authHeader) headers.Authorization = authHeader;

  let r = await fetch(src, { headers, redirect: "follow" });
  if (!r.ok && authHeader) {
    r = await fetch(src, { redirect: "follow" });
  }
  if (!r.ok) throw new Error(`Falha ao baixar foto (HTTP ${r.status})`);

  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 32) throw new Error("Foto inválida");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Foto muito grande (máx. 8 MB)");

  return {
    mimeType: guessMime(src, r.headers.get("content-type")),
    buffer: buf,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const authHeader = req.headers.authorization || "";
    let url = "";

    if (req.method === "GET") {
      url = String(req.query?.url || "");
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      url = String(body.url || body.fotoUrl || "");
    } else {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!url) {
      res.status(400).json({ error: "Envie url" });
      return;
    }

    const { mimeType, buffer } = await downloadFoto(url, authHeader);

    if (req.method === "GET") {
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.status(200).send(buffer);
      return;
    }

    res.status(200).json({
      mimeType,
      data: buffer.toString("base64"),
    });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Erro ao baixar foto" });
  }
}
