import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "static-preview");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let filePath = path.join(root, decodeURIComponent(url.pathname));
  if (url.pathname === "/") filePath = path.join(root, "index.html");

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, "index.html");
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.statusCode = 500;
    res.end("server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static preview on http://127.0.0.1:${port}/`);
});
