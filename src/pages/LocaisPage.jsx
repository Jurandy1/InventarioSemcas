import React from "react";

export function LocaisPage({ locais, found, onNew, onDelete, showT, isMob, bp, cd }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📍 Locais</h2>
        <button onClick={onNew} style={bp}>
          + Novo
        </button>
      </div>
      {locais.length === 0 ? (
        <div style={{ ...cd, textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 48 }}>📍</p>
          <p style={{ color: "#94a3b8" }}>Cadastre locais</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {locais.map((l) => {
            const c = found.filter((f) => f.localId === l.id).length;
            return (
              <div key={l.id} style={{ ...cd, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>📍 {l.nome}</p>
                  {l.desc && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>{l.desc}</p>}
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{c} item(s)</p>
                </div>
                <button
                  onClick={() => {
                    if (c > 0) {
                      showT("Remova itens antes");
                      return;
                    }
                    onDelete(l);
                  }}
                  style={{ border: "none", background: "#fff0f0", color: "#dc2626", borderRadius: 7, padding: "6px 10px", cursor: "pointer" }}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

