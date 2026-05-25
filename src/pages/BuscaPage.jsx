import React from "react";
import { Badge } from "../components/Badge.jsx";
import { TInput } from "../components/FormFields.jsx";
import { EC } from "../constants/inventory.js";

function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}

export function BuscaPage({
  globalSearch,
  globalResults,
  globalSearching,
  onSearchChange,
  onOpenItem,
  foundMap,
  unidades,
  saveAtiva,
  isMob,
  inp,
  cd,
}) {
  return (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>🔍 Busca</h2>
      <TInput initial="" onVal={onSearchChange} placeholder="Buscar em todas as unidades (mín. 2 caracteres)..." style={{ ...inp, marginBottom: 12 }} />
      {globalSearching && <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>Buscando...</p>}
      {!globalSearching && globalSearch.trim().length >= 2 && <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>{globalResults.length} resultado(s)</p>}
      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px,1fr))", gap: 10 }}>
        {globalResults.map((item) => {
          const fEntry = foundMap[item.id];
          const isPermuta = fEntry?.situacao === "Permuta";
          const displayDesc = getDisplayDesc(item, fEntry);
          return (
            <div
              key={`${item.unidadeId}_${item.id}`}
              onClick={() => {
                const u = unidades.find((x) => x.id === item.unidadeId);
                if (u) saveAtiva(u);
                onOpenItem(item);
              }}
              style={{ ...cd, cursor: "pointer", border: `1.5px solid ${isPermuta ? "#fcd34d" : fEntry ? "#bbf7d0" : "#e2e8f0"}` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{displayDesc}</p>

                  {isPermuta && fEntry?.permutaDesc && (
                    <div style={{ marginTop: 6, padding: "6px 10px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#92400e", letterSpacing: ".04em", textTransform: "uppercase" }}>🔄 Item real encontrado</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "#78350f" }}>
                        {fEntry.permutaDesc}
                        {fEntry.permutaMarca ? ` · ${fEntry.permutaMarca}` : ""}
                      </p>
                    </div>
                  )}

                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
                    Nº {getItemCode(item)} · {(item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 50)}
                  </p>
                  {item.fornecedor && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>🏭 {item.fornecedor}{item.nf ? ` · NF ${item.nf}` : ""}</p>}
                </div>
                {fEntry ? <Badge label={fEntry.estado} c={EC[fEntry.estado]} /> : <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

