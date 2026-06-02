import React from "react";
import { getDisplayPhotoUrl } from "../services/storage.js";

export function Overlay({ children, onClose, isMobile }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 300,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: isMobile ? "20px 20px 0 0" : 16,
          width: isMobile ? "100%" : "520px",
          maxHeight: isMobile ? "90dvh" : "85vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          padding: 24,
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
        background: "rgba(0,0,0,.92)",
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
        onClick={() => onClose?.()}
        style={{
          position: "fixed",
          top: "max(12px, env(safe-area-inset-top, 0px))",
          right: "max(12px, env(safe-area-inset-right, 0px))",
          background: "rgba(255,255,255,.15)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,.2)",
          borderRadius: 12,
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 800,
          minHeight: 40,
          cursor: "pointer",
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
          borderRadius: 12,
          background: "rgba(255,255,255,.06)",
        }}
        decoding="async"
      />
    </div>
  );
}
