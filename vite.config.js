import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Proxy local (dev + preview) para /api/foto-proxy — mesmo contrato da Vercel. */
function fotoProxyPlugin() {
  const middleware = async (req, res, next) => {
    const rawUrl = req.url || "";
    if (!rawUrl.startsWith("/api/foto-proxy")) return next();

    try {
      const parsed = new URL(rawUrl, "http://localhost");
      let fotoUrl = parsed.searchParams.get("url") || "";
      const authHeader = req.headers.authorization || "";

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.end();
        return;
      }

      if (req.method === "POST") {
        const buf = await readBody(req);
        const body = JSON.parse(buf.toString("utf8") || "{}");
        fotoUrl = String(body.url || body.fotoUrl || fotoUrl || "");
      }

      if (!isAllowedFotoUrl(fotoUrl)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "URL de foto não permitida" }));
        return;
      }

      const headers = {};
      if (authHeader) headers.Authorization = authHeader;
      let r = await fetch(fotoUrl, { headers, redirect: "follow" });
      if (!r.ok && authHeader) r = await fetch(fotoUrl, { redirect: "follow" });
      if (!r.ok) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: `Falha ao baixar foto (HTTP ${r.status})` }));
        return;
      }

      const ab = await r.arrayBuffer();
      const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];

      if (req.method === "POST") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ mimeType: mime, data: Buffer.from(ab).toString("base64") }));
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.end(Buffer.from(ab));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: e?.message || "Erro no proxy de foto" }));
    }
  };

  return {
    name: "foto-proxy-local",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ command }) => {
  const repoName = "InventarioSemcas";
  const baseOverride = String(process.env.VITE_BASE || "").trim();
  // Só GitHub Pages usa subpath; Vercel/Netlify também setam CI=true — não usar CI aqui.
  const isGitHubPages = Boolean(process.env.GITHUB_ACTIONS);

  return {
    envDir: projectRoot,
    base: baseOverride || (command === "build" ? (isGitHubPages ? `/${repoName}/` : "/") : "/"),
    plugins: [react({ jsxRuntime: "classic" }), fotoProxyPlugin()],
    build:
      command === "build"
        ? {
            minify: "esbuild",
            cssMinify: true,
            sourcemap: false,
            rollupOptions: {
              output: {
                manualChunks(id) {
                  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "react-vendor";
                  if (id.includes("node_modules/xlsx")) return "xlsx";
                },
              },
            },
          }
        : undefined,
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      exclude: ["xlsx", "xlsx/xlsx.mjs"],
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
