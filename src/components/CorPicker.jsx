import React, { useState } from "react";
import { CORES_ITEM, corItemById, labelCorItem } from "../constants/cores.js";

/**
 * Seletor de cor principal do item (chips + opcional “Outra”).
 * value: id da cor (ex.: "preto") ou texto livre.
 */
export function CorPicker({ value = "", onChange, isMob = false, label = "Cor principal" }) {
  const known = corItemById(value);
  const isOutra = Boolean(value) && !known;
  const [showOutra, setShowOutra] = useState(isOutra);

  const select = (id) => {
    setShowOutra(false);
    onChange?.(id === value ? "" : id);
  };

  return (
    <div>
      {label ? (
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#374151" }}>{label}</p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CORES_ITEM.map((c) => {
          const active = known?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: isMob ? "9px 12px" : "6px 10px",
                minHeight: isMob ? 40 : undefined,
                borderRadius: 99,
                border: `2px solid ${active ? "#1351B4" : "#e2e8f0"}`,
                background: active ? "#eff6ff" : "#fff",
                cursor: "pointer",
                fontSize: isMob ? 13 : 11,
                fontWeight: 700,
                color: active ? "#1351B4" : "#334155",
                touchAction: "manipulation",
              }}
              title={c.label}
            >
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: c.hex,
                  border: `1px solid ${c.border || "rgba(0,0,0,.2)"}`,
                  flexShrink: 0,
                }}
              />
              {c.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setShowOutra(true);
            if (!isOutra) onChange?.("");
          }}
          style={{
            padding: isMob ? "9px 12px" : "6px 10px",
            minHeight: isMob ? 40 : undefined,
            borderRadius: 99,
            border: `2px solid ${showOutra || isOutra ? "#1351B4" : "#e2e8f0"}`,
            background: showOutra || isOutra ? "#eff6ff" : "#fff",
            cursor: "pointer",
            fontSize: isMob ? 13 : 11,
            fontWeight: 700,
            color: showOutra || isOutra ? "#1351B4" : "#334155",
            touchAction: "manipulation",
          }}
        >
          Outra…
        </button>
      </div>
      {(showOutra || isOutra) && (
        <input
          value={isOutra ? value : ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Digite a cor (ex: azul petróleo)"
          style={{
            marginTop: 8,
            width: "100%",
            boxSizing: "border-box",
            border: "1.5px solid #d1d5db",
            borderRadius: 9,
            padding: isMob ? "12px 13px" : "10px 13px",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      )}
      {value ? (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>
          Selecionada: <strong style={{ color: "#0f172a" }}>{labelCorItem(value)}</strong>
          {" · "}
          <button
            type="button"
            onClick={() => {
              setShowOutra(false);
              onChange?.("");
            }}
            style={{ background: "none", border: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}
          >
            limpar
          </button>
        </p>
      ) : null}
    </div>
  );
}
