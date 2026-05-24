import * as React from "react";

export function Badge({ label, c }) {
  if (!c) c = { bg: "#f1f5f9", tx: "#475569" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 16,
        fontSize: 10,
        fontWeight: 700,
        background: c.bg,
        color: c.tx,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
