// SUBSTITUIR o conteúdo de src/main.jsx POR ISSO:

import React from "react";
import ReactDOM from "react-dom/client";

const path = String(window.location.pathname || "");
const hash = String(window.location.hash || "");
const isCoordPage = path.includes("/coord/") || hash.includes("#/coord/");
const isCoordRegistro = path.includes("/coordregistro/") || hash.includes("#/coordregistro/");

const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.innerHTML = `<div style="min-height:100vh;background:#f1f5f9;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.06)"><div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:6px">Carregando…</div><div style="font-size:12px;color:#64748b">Iniciando aplicação</div></div></div>`;
}

const renderFatal = (err) => {
  const root = document.getElementById("root");
  if (!root) return;
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  root.innerHTML = `<div style="min-height:100vh;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial"><div style="max-width:720px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px"><div style="font-weight:800;font-size:14px;color:#991b1b;margin-bottom:8px">Erro ao carregar a aplicação</div><pre style="white-space:pre-wrap;margin:0;color:#0f172a;font-size:12px;line-height:1.4">${msg}</pre></div></div>`;
};

window.addEventListener("error", (e) => renderFatal(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => renderFatal(e.reason));

async function boot() {
  const el = document.getElementById("root");
  if (!el) return;
  const root = ReactDOM.createRoot(el);

  if (isCoordRegistro) {
    const mod = await import("./app/CoordinadorRegistro.jsx");
    root.render(
      <React.StrictMode>
        <mod.CoordinadorRegistro />
      </React.StrictMode>,
    );
  } else if (isCoordPage) {
    const mod = await import("./app/CoordinadorLogin.jsx");
    root.render(
      <React.StrictMode>
        <mod.CoordinadorLogin />
      </React.StrictMode>,
    );
  } else {
    const mod = await import("./app/App.jsx");
    root.render(
      <React.StrictMode>
        <mod.default />
      </React.StrictMode>,
    );
  }
}

boot().catch(renderFatal);
