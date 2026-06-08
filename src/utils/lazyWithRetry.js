import React from "react";

const RELOAD_KEY = "inv_chunk_reload_v1";

/** Limpa o flag de reload após boot bem-sucedido. */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {}
}

function isChunkLoadError(err) {
  const msg = err instanceof Error ? err.message : String(err || "");
  const m = msg.toLowerCase();
  return (
    m.includes("dynamically imported module") ||
    m.includes("importing a module script failed") ||
    (m.includes("failed to fetch") && m.includes(".js"))
  );
}

function reloadOnceForStaleChunks() {
  try {
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
      return true;
    }
  } catch {}
  return false;
}

/** React.lazy com reload automático quando chunk hash ficou defasado após deploy. */
export function lazyWithRetry(factory) {
  return React.lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnceForStaleChunks()) {
        return new Promise(() => {});
      }
      throw err;
    })
  );
}
