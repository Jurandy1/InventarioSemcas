/** Detecção leve de aparelhos lentos ou conexão fraca (sem UA sniffing). */
export function isLikelySlowDevice() {
  if (typeof navigator === "undefined") return false;
  try {
    const cores = Number(navigator.hardwareConcurrency || 0);
    const mem = Number(navigator.deviceMemory || 0);
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const slowNet =
      conn &&
      (conn.saveData ||
        conn.effectiveType === "slow-2g" ||
        conn.effectiveType === "2g" ||
        conn.effectiveType === "3g");
    if (slowNet) return true;
    if (cores > 0 && cores <= 4) return true;
    if (mem > 0 && mem <= 3) return true;
  } catch {}
  return false;
}

export function isPageHidden() {
  return typeof document !== "undefined" && document.hidden;
}

/** Intervalos de sync mais longos em celular lento ou aba em segundo plano. */
export function getSyncIntervals({ paused = false, isMobile = false } = {}) {
  const slow = isLikelySlowDevice();
  const base = slow || isMobile ? 1.6 : 1;
  if (paused) {
    return { inventarioMs: Math.round(90000 * base), locaisMs: 999999999 };
  }
  return {
    inventarioMs: Math.round(15000 * base),
    locaisMs: Math.round(30000 * base),
    hiddenInventarioMs: Math.round(120000 * base),
    hiddenLocaisMs: Math.round(180000 * base),
  };
}

/**
 * Polling que desacelera com aba oculta e retoma ao voltar.
 * @returns cleanup function
 */
export function createVisibilityAwarePoller(fn, { activeMs, hiddenMs = activeMs * 4, runImmediately = true } = {}) {
  if (typeof window === "undefined") return () => {};
  let timer = null;
  let running = false;

  const getMs = () => (isPageHidden() ? hiddenMs : activeMs);

  const tick = async () => {
    if (running) return;
    if (isPageHidden() && hiddenMs >= 999999999) return;
    running = true;
    try {
      await fn();
    } catch {}
    running = false;
  };

  const reschedule = () => {
    if (timer) clearInterval(timer);
    timer = setInterval(tick, getMs());
  };

  const onVisibility = () => {
    reschedule();
    if (!isPageHidden()) tick();
  };

  if (runImmediately) tick();
  reschedule();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Tamanho de lote para compressão de fotos conforme o aparelho. */
export function getPhotoBatchSize() {
  return isLikelySlowDevice() ? 1 : 2;
}

export function getPhotoBatchDelayMs() {
  return isLikelySlowDevice() ? 180 : 100;
}
