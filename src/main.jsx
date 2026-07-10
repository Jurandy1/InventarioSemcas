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

const CHUNK_RELOAD_KEY = "inv_chunk_reload_v1";

const isChunkLoadError = (err) => {
  const msg = err instanceof Error ? err.message : String(err || "");
  const m = msg.toLowerCase();
  return (
    m.includes("dynamically imported module") ||
    m.includes("importing a module script failed") ||
    (m.includes("failed to fetch") && m.includes(".js"))
  );
};

const reloadOnceForStaleChunks = () => {
  try {
    if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
      return true;
    }
  } catch {}
  return false;
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

// Um erro engolido (ex.: ReferenceError num handler async de botão) faz o
// usuário achar que "o botão não funciona". Em vez de só logar no console,
// mostramos um banner visível — o usuário vê que algo estourou e sabe que
// precisa reportar ou recarregar. Também acionamos recarga forçada quando
// suspeitamos de bundle stale (fica logo depois de deploy novo).
const showErrorBanner = (err) => {
  try {
    if (document.getElementById("__inv_err_banner")) return;
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err || "");
    const el = document.createElement("div");
    el.id = "__inv_err_banner";
    el.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#991b1b;color:#fff;padding:10px 14px;font:600 13px system-ui,-apple-system,Segoe UI,Roboto,Arial;display:flex;gap:10px;align-items:center;box-shadow:0 -2px 12px rgba(0,0,0,.2)";
    el.innerHTML =
      '<span style="flex:1;line-height:1.35">Ocorreu um erro. Tente recarregar (se persistir, feche o app e abra de novo).<br><span style="font-weight:400;opacity:.85;font-size:11px">' +
      msg.replace(/</g, "&lt;") +
      '</span></span><button style="background:#fff;color:#991b1b;border:0;border-radius:6px;padding:8px 12px;font:700 12px inherit;cursor:pointer">Recarregar</button><button aria-label="Fechar" style="background:transparent;color:#fff;border:0;font-size:20px;cursor:pointer;padding:2px 8px">×</button>';
    const [reloadBtn, closeBtn] = el.querySelectorAll("button");
    reloadBtn.addEventListener("click", () => {
      try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch {}
      window.location.reload();
    });
    closeBtn.addEventListener("click", () => el.remove());
    document.body.appendChild(el);
  } catch {}
};

window.addEventListener("error", (e) => {
  const err = e?.error || e?.message;
  if (isAbortError(err)) return;
  console.error("Erro não tratado:", err);
  showErrorBanner(err);
});
window.addEventListener("unhandledrejection", (e) => {
  const err = e?.reason;
  if (isAbortError(err)) return;
  if (isChunkLoadError(err) && reloadOnceForStaleChunks()) {
    e.preventDefault?.();
    return;
  }
  console.error("Promise rejeitada:", err);
  showErrorBanner(err);
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

async function importWithRetry(factory) {
  try {
    return await factory();
  } catch (err) {
    if (isChunkLoadError(err) && reloadOnceForStaleChunks()) {
      return new Promise(() => {});
    }
    throw err;
  }
}

async function boot() {
  const el = document.getElementById("root");
  if (!el) return;
  const root = createRoot(el);

  if (isInvRegistro) {
    const mod = await importWithRetry(() => import("./app/inventariante/InventarianteRegistro.jsx"));
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.InventarianteRegistro)));
  } else if (isCoordRegistro) {
    const mod = await importWithRetry(() => import("./app/coord/CoordinadorRegistro.jsx"));
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.CoordinadorRegistro)));
  } else if (isCoordPage) {
    const mod = await importWithRetry(() => import("./app/coord/CoordinadorLogin.jsx"));
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.CoordinadorLogin)));
  } else {
    const mod = await importWithRetry(() => import("./app/App.jsx"));
    root.render(React.createElement(React.StrictMode, null, React.createElement(mod.default)));
  }
}

boot().catch((e) => {
  if (isAbortError(e)) return;
  renderFatal(e);
});
