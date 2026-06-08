import React from "react";
import { TInput } from "./FormFields.jsx";
import { UFS_BRASIL } from "../constants/inventory.js";

/** Origem da doação: UF ou texto livre (manual / sem tombo). */
export function DoacaoOrigemFields({ prefix = "man", getField, setField, bumpFt, inp, ft = 0 }) {
  const modo = getField(`${prefix}DoacaoModo`) || "uf";
  const uf = getField(`${prefix}DoacaoUf`) || "MA";

  return (
    <div style={{ marginTop: 12, padding: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#92400e" }}>Origem da doação</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[
          { id: "uf", label: "UF (estado)" },
          { id: "texto", label: "Escrever manualmente" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setField(`${prefix}DoacaoModo`, m.id);
              bumpFt?.();
            }}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              border: `2px solid ${modo === m.id ? "#d97706" : "#e2e8f0"}`,
              background: modo === m.id ? "#fef3c7" : "#fff",
              color: modo === m.id ? "#92400e" : "#64748b",
              minHeight: 44,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      {modo === "uf" ? (
        <>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#78350f", marginBottom: 6 }}>Estado (UF)</label>
          <select
            key={`${prefix}DoacaoUf_${ft}`}
            value={uf}
            onChange={(e) => {
              setField(`${prefix}DoacaoUf`, e.target.value);
              bumpFt?.();
            }}
            style={inp}
          >
            {UFS_BRASIL.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#78350f", marginBottom: 6 }}>Descrição da origem</label>
          <TInput
            key={`${prefix}DoacaoTxt_${ft}`}
            initial={getField(`${prefix}DoacaoTexto`) || ""}
            onVal={(v) => setField(`${prefix}DoacaoTexto`, v)}
            placeholder="Ex: Prefeitura de São Luís, empresa X..."
            style={inp}
          />
        </>
      )}
    </div>
  );
}
