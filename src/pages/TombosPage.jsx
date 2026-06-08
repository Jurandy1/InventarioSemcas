import React, { useMemo, useState } from "react";

const PER_PAGE = 20;

export function TombosPage({ tombosNE, tombosDup, tombosTab, setTombosTab, isMob, bp, bs, cd }) {
  const [page, setPage] = useState(1);

  const list = tombosTab === "ne" ? tombosNE : tombosDup;
  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const paged = useMemo(() => list.slice((page - 1) * PER_PAGE, page * PER_PAGE), [list, page]);

  const switchTab = (tab) => {
    setTombosTab(tab);
    setPage(1);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Tombos</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => switchTab("ne")} style={{ ...(tombosTab === "ne" ? bp : bs), fontSize: 12, minHeight: 44 }}>
          Não encontrados ({tombosNE.length})
        </button>
        <button type="button" onClick={() => switchTab("dup")} style={{ ...(tombosTab === "dup" ? bp : bs), fontSize: 12, minHeight: 44 }}>
          Duplicados / divergências ({tombosDup.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div style={{ ...cd, textAlign: "center", padding: 40 }}>
          <p style={{ color: "#94a3b8" }}>
            {tombosTab === "ne" ? "Nenhum tombo pendente de localização." : "Nenhuma duplicidade ou divergência detectada."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
            {paged.map((i, idx) => (
              <div key={`${i.id || i.patrimonioId || idx}_${page}`} style={{ ...cd, border: `1.5px solid ${tombosTab === "ne" ? "#fca5a5" : "#c084fc"}` }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: tombosTab === "ne" ? "#dc2626" : "#7c3aed" }}>
                  {i.descricao || i.especie}
                </p>
                <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>
                  Nº {i.id || i.patrimonioId} · {i.unidade || i.unidadeOrigem || ""}
                </p>
                {tombosTab === "dup" &&
                  (i.tipo === "label_dup" ? (
                    <p style={{ margin: 0, fontSize: 11, color: "#92400e" }}>Tombo repetido em: {i.unidadeOrigem}</p>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 11, color: "#dc2626" }}>Pertence: {i.unidadeOrigem}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#16a34a" }}>Inventariado em: {i.unidadeEncontrada}</p>
                    </>
                  ))}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...bs, minHeight: 44, padding: "8px 14px" }}>
                ‹ Anterior
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Pág {page}/{totalPages} · {list.length} itens
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ ...bs, minHeight: 44, padding: "8px 14px" }}
              >
                Próxima ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
