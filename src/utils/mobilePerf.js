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

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

/** Celular ou aparelho lento — reduz trabalho em background. */
export function shouldReduceWork() {
  return isMobileViewport() || isLikelySlowDevice();
}

/** Margem do IntersectionObserver: menor no mobile para carregar menos fotos à frente. */
export function getLazyImageRootMargin() {
  if (shouldReduceWork()) return "60px";
  return "200px";
}

/** Limites de captura da câmera conforme o aparelho. */
export function getCameraCaptureLimits() {
  const mobile = isMobileViewport();
  const slow = isLikelySlowDevice();
  if (mobile || slow) {
    return {
      idealWidth: 1280,
      idealHeight: 720,
      maxWidth: 1280,
      maxHeight: 960,
      jpegQuality: 0.72,
    };
  }
  return {
    idealWidth: 1920,
    idealHeight: 1080,
    maxWidth: 1600,
    maxHeight: 1200,
    jpegQuality: 0.8,
  };
}

/** Paginação e lotes de lista — menos itens no mobile. */
export function getListLimits(isMobile = isMobileViewport()) {
  if (isMobile) {
    return {
      perPage: 12,
      coletadosLimit: 10,
      localItemsStep: 10,
      coletadosStep: 10,
    };
  }
  return {
    perPage: 24,
    coletadosLimit: 20,
    localItemsStep: 15,
    coletadosStep: 20,
  };
}

/** Intervalos de polling de presença da equipe. */
export function getPresencePollMs(isMobile = isMobileViewport()) {
  if (isMobile || isLikelySlowDevice()) {
    return { activeMs: 60_000, hiddenMs: 180_000, teamActiveMs: 90_000, teamHiddenMs: 300_000 };
  }
  return { activeMs: 45_000, hiddenMs: 120_000, teamActiveMs: 45_000, teamHiddenMs: 180_000 };
}

export function isPageHidden() {
  return typeof document !== "undefined" && document.hidden;
}

/** Intervalos de sync mais longos em celular lento ou aba em segundo plano. */
export function getSyncIntervals({ paused = false, isMobile = false, lowPriority = false } = {}) {
  const slow = isLikelySlowDevice();
  const base = slow || isMobile ? 2 : 1;
  const tabMul = lowPriority ? 3 : 1;
  if (paused) {
    return { inventarioMs: Math.round(300000 * base * tabMul), locaisMs: 999999999 };
  }
  return {
    inventarioMs: Math.round(60000 * base * tabMul),
    locaisMs: Math.round(120000 * base * tabMul),
    hiddenInventarioMs: Math.round(300000 * base * tabMul),
    hiddenLocaisMs: Math.round(600000 * base * tabMul),
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
  if (shouldReduceWork()) return 1;
  return 2;
}

export function getPhotoBatchDelayMs() {
  if (shouldReduceWork()) return 220;
  return 100;
}
