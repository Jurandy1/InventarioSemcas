import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getDisplayPhotoUrl } from "../services/storage.js";
import { getLazyImageRootMargin } from "../utils/mobilePerf.js";

/**
 * Imagem com lazy-load e resolução automática de URLs Firebase.
 *
 * Problemas resolvidos:
 * 1. URLs gs:// ou Firebase sem token → fetch com auth → blob URL
 * 2. Blob URLs revogadas pelo cache → onError → re-fetch silencioso
 * 3. Imagem nunca fica cinza: usa o src original como fallback enquanto aguarda
 */
export function SmartImg({ src, alt = "", style, ...rest }) {
  const ref = useRef(null);
  const [resolved, setResolved] = useState("");
  const [visible, setVisible] = useState(false);
  const fetchingRef = useRef(false);
  const safeSrc = String(src || "");
  const rootMargin = useMemo(() => getLazyImageRootMargin(), []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !safeSrc) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [safeSrc]);

  useEffect(() => {
    if (!visible || !safeSrc) return;
    let alive = true;
    fetchingRef.current = true;
    // Usar safeSrc imediatamente para evitar estado cinza inicial
    setResolved(safeSrc);
    (async () => {
      try {
        const next = await getDisplayPhotoUrl(safeSrc);
        if (!alive) return;
        // Só atualiza se a URL resolvida for diferente (ex: blob URL autenticada)
        if (next && next !== safeSrc) setResolved(next);
      } finally {
        if (alive) fetchingRef.current = false;
      }
    })();
    return () => { alive = false; };
  }, [safeSrc, visible]);

  // Quando o <img> falha (URL expirada, blob revogado, sem auth), tenta re-fetch
  const handleError = useCallback(() => {
    if (!safeSrc || fetchingRef.current) return;
    fetchingRef.current = true;
    (async () => {
      try {
        // Forçar nova URL ignorando cache (blob URL pode ter sido revogado)
        const next = await getDisplayPhotoUrl(safeSrc, { forceRefresh: true });
        if (next) setResolved(next);
      } catch {
        // silencioso — mantém resolved atual
      } finally {
        fetchingRef.current = false;
      }
    })();
  }, [safeSrc]);

  return (
    <img
      ref={ref}
      src={visible ? (resolved || safeSrc || undefined) : undefined}
      alt={alt}
      style={style}
      loading="lazy"
      decoding="async"
      onError={handleError}
      {...rest}
    />
  );
}
