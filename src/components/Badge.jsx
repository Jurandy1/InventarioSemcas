import React from "react";

export function Badge({ label, c }) {
  if (!c) c = { bg: "#F0F2F5", tx: "#555555", border: "#CCCCCC" };
  return (
    <span
      className="gov-status-badge"
      style={{
        background: c.bg,
        color: c.tx,
        borderColor: c.border || "transparent",
      }}
    >
      {label}
    </span>
  );
}
