import React from "react";

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
