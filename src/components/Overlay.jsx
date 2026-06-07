import React, { useEffect, useRef } from "react";
import { getDisplayPhotoUrl } from "../services/storage.js";

export function Overlay({ children, onClose, isMobile, suppressBackdropMs = 0 }) {
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    mountedAt.current = Date.now();
  }, [children, suppressBackdropMs]);

  const handleBackdropClick = (e) => {
    if (e.target !== e.currentTarget) return;
    const blockUntil = mountedAt.current + Math.max(0, suppressBackdropMs);
    if (Date.now() < blockUntil) return;
    onClose?.();
  };

  return (
    <div className="gov-modal-overlay" onClick={handleBackdropClick}>
      <div
        className="gov-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: isMobile ? "calc(24px + env(safe-area-inset-bottom, 0px))" : 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ImageOverlay({ src, onClose }) {
  const [resolved, setResolved] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    setResolved("");
    (async () => {
      const next = await getDisplayPhotoUrl(src);
      if (!alive) return;
      setResolved(next || String(src || ""));
    })();
    return () => {
      alive = false;
    };
  }, [src]);

  if (!src) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12, 50, 111, 0.92)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <button
        type="button"
        onClick={() => onClose?.()}
        className="gov-btn gov-btn--ghost"
        style={{
          position: "fixed",
          top: "max(12px, env(safe-area-inset-top, 0px))",
          right: "max(12px, env(safe-area-inset-right, 0px))",
          zIndex: 501,
        }}
      >
        Fechar
      </button>

      <img
        src={resolved || String(src || "")}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: 4,
          background: "rgba(255,255,255,.06)",
        }}
        decoding="async"
      />
    </div>
  );
}
