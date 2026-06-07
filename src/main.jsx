import * as React from "react";
import { createRoot } from "react-dom/client";

const path = String(window.location.pathname || "");
const hash = String(window.location.hash || "");
const isCoordPage      = path.includes("/coord/")        || hash.includes("#/coord/");
const isCoordRegistro  = path.includes("/coordregistro/") || hash.includes("#/coordregistro/");
const isInvRegistro    = path.includes("/invregistro/")   || hash.includes("#/invregistro/");

const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.innerHTML = `<div class="gov-loading"><div class="gov-spinner"></div><p style="color:var(--gov-text-muted);font-size:13px">Iniciando aplicação…</p></div>`;
}

const renderFatal = (err) => {
  const root = document.getElementById("root");
  if (!root) return;
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  root.innerHTML = `<div style="min-height:100vh;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial"><div style="max-width:720px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px"><div style="font-weight:800;font-size:14px;color:#991b1b;margin-bottom:8px">Erro ao carregar a aplicação</div><pre style="white-space:pre-wrap;margin:0;color:#0f172a;font-size:12px;line-height:1.4">${msg}</pre></div></div>`;
};

const isAbortError = (err) => {
  const name = err && typeof err === "object" && "name" in err ? String(err.name || "") : "";
  const msg =
    err instanceof Error
      ? String(err.message || "")
      : err && typeof err === "object" && "message" in err
        ? String(err.message || "")
        : String(err || "");
  const m = msg.toLowerCase();
  return name === "AbortError" || m.includes("signal is aborted") || m.includes("aborted without reason") || m.includes("the user aborted");
};

window.addEventListener("error", (e) => {
  const err = e?.error || e?.message;
  if (isAbortError(err)) return;
  console.error("Erro não tratado:", err);
});
window.addEventListener("unhandledrejection", (e) => {
  const err = e?.reason;
  if (isAbortError(err)) return;
  console.error("Promise rejeitada:", err);
  e.preventDefault?.();
});

window.addEventListener("hashchange", () => {
  const h = String(window.location.hash || "");
  const p = String(window.location.pathname || "");
  const nowRegistro =
    p.includes("/invregistro/") ||
    p.includes("/coordregistro/") ||
    h.includes("#/invregistro/") ||
    h.includes("#/coordregistro/");
  const wasRegistro = isInvRegistro || isCoordRegistro;
  if (nowRegistro !== wasRegistro) {
    window.location.reload();
  }
});

async function boot() {
  const el = document.getElementById("root");
  if (!el) return;
  const root = createRoot(el);

  if (isInvRegistro) {
    const mod = await import("./app/InventarianteRegistro.jsx");
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.InventarianteRegistro)));
  } else if (isCoordRegistro) {
    const mod = await import("./app/CoordinadorRegistro.jsx");
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.CoordinadorRegistro)));
  } else if (isCoordPage) {
    const mod = await import("./app/CoordinadorLogin.jsx");
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.CoordinadorLogin)));
  } else {
    const mod = await import("./app/App.jsx");
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.default)));
  }
}

boot().catch((e) => {
  if (isAbortError(e)) return;
  renderFatal(e);
});
