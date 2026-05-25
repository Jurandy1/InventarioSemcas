import React from "react";

export function ToastNotification({ message, isMobile }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? "calc(78px + env(safe-area-inset-bottom, 0px) + 10px)" : 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1e3a8a",
        color: "#fff",
        padding: "11px 24px",
        borderRadius: 24,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 400,
        boxShadow: "0 4px 16px rgba(0,0,0,.25)",
        maxWidth: "92vw",
      }}
    >
      {message}
    </div>
  );
}
