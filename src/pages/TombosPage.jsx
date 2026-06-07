import React from "react";

export function TombosPage({ tombosNE, tombosDup, tombosTab, setTombosTab, isMob, bp, bs, cd }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Tombos</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setTombosTab("ne")} style={{ ...(tombosTab === "ne" ? bp : bs), fontSize: 12 }}>
          Não encontrados ({tombosNE.length})
        </button>
        <button onClick={() => setTombosTab("dup")} style={{ ...(tombosTab === "dup" ? bp : bs), fontSize: 12 }}>
          Duplicados / divergências ({tombosDup.length})
        </button>
      </div>

      {tombosTab === "ne" &&
        (tombosNE.length === 0 ? (
          <div style={{ ...cd, textAlign: "center", padding: 40 }}>
            <p style={{ color: "#94a3b8" }}>Nenhum tombo pendente de localização.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
            {tombosNE.map((i, idx) => (
              <div key={idx} style={{ ...cd, border: "1.5px solid #fca5a5" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{i.descricao || i.especie}</p>
                <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>Nº {i.id || i.patrimonioId} · {i.unidade}</p>
              </div>
            ))}
          </div>
        ))}

      {tombosTab === "dup" &&
        (tombosDup.length === 0 ? (
          <div style={{ ...cd, textAlign: "center", padding: 40 }}>
            <p style={{ color: "#94a3b8" }}>Nenhuma duplicidade ou divergência detectada.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
            {tombosDup.map((i, idx) => (
              <div key={idx} style={{ ...cd, border: "1.5px solid #c084fc" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>{i.descricao || i.especie}</p>
                <p style={{ margin: "4px 0", fontSize: 11, color: "#64748b" }}>Nº {i.id}</p>
                {i.tipo === "label_dup" ? (
                  <p style={{ margin: 0, fontSize: 11, color: "#92400e" }}>Tombo repetido em: {i.unidadeOrigem}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 11, color: "#dc2626" }}>Pertence: {i.unidadeOrigem}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#16a34a" }}>Inventariado em: {i.unidadeEncontrada}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
