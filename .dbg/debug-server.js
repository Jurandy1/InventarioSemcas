import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const k = key.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[k] = v;
  }
  return args;
}

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net && net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

function safeMkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeEnvFile(outdirAbs, sessionId, apiUrl) {
  const envFile = path.join(outdirAbs, `${sessionId}.env`);
  fs.writeFileSync(envFile, `DEBUG_SERVER_URL=${apiUrl}\nDEBUG_SESSION_ID=${sessionId}\n`, "utf8");
  return envFile;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const args = parseArgs(process.argv);
const sessionId = String(args.session || "").trim();
if (!sessionId) {
  process.stderr.write("Missing --session\n");
  process.exit(2);
}

const outdir = path.resolve(process.cwd(), String(args.outdir || ".dbg"));
safeMkdir(outdir);

const remote = String(args.remote || "false") === "true";
const host = remote ? "0.0.0.0" : "127.0.0.1";
const clean = String(args.clean || "false") === "true";
const idleSeconds = Number(args.idle || 0);
const basePort = Number(args.port || 7777);
const maxTries = 10;

const logFile = path.join(outdir, `trae-debug-log-${sessionId}.ndjson`);
if (clean) {
  try {
    fs.writeFileSync(logFile, "", "utf8");
  } catch {}
}

let lastEventAt = Date.now();
if (idleSeconds > 0) {
  setInterval(() => {
    if (Date.now() - lastEventAt > idleSeconds * 1000) process.exit(0);
  }, 1000).unref();
}

function startServer(port, attempt = 0) {
  const server = http.createServer((req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.url === "/health" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, sessionId, logFile, ts: Date.now() }));
      return;
    }

    if (req.url === "/logs" && req.method === "GET") {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      try {
        res.end(fs.readFileSync(logFile, "utf8"));
      } catch {
        res.end("");
      }
      return;
    }

    if (req.url === "/logs" && req.method === "DELETE") {
      try {
        fs.writeFileSync(logFile, "", "utf8");
      } catch {}
      res.statusCode = 200;
      res.end("ok");
      return;
    }

    if (req.url !== "/event" || req.method !== "POST") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.socket.destroy();
    });
    req.on("end", () => {
      lastEventAt = Date.now();
      try {
        const evt = JSON.parse(body || "{}");
        if (!evt.ts) evt.ts = Date.now();
        fs.appendFileSync(logFile, `${JSON.stringify(evt)}\n`, "utf8");
        res.statusCode = 200;
        res.end("ok");
      } catch {
        res.statusCode = 400;
        res.end("bad json");
      }
    });
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE" && attempt < maxTries) startServer(port + 1, attempt + 1);
    else {
      process.stderr.write(String(err?.stack || err) + "\n");
      process.exit(1);
    }
  });

  server.listen(port, host, () => {
    const ip = remote ? getLocalIPv4() : "127.0.0.1";
    const apiUrl = `http://${ip}:${port}/event`;
    const envFile = writeEnvFile(outdir, sessionId, apiUrl);
    const info = {
      api_url: apiUrl,
      session_id: sessionId,
      log_dir: outdir,
      log_file: logFile,
      env_file: envFile,
    };
    process.stdout.write("@@DEBUG_SERVER_INFO\n");
    process.stdout.write(JSON.stringify(info, null, 2) + "\n");
    process.stdout.write("@@END_DEBUG_SERVER_INFO\n");
  });
}

startServer(basePort);

