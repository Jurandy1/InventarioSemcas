import React from "react";
import { TInput } from "../components/FormFields.jsx";

function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}

export function NotasFiscaisPage({
  nfDataList,
  nfSearch,
  setNfSearch,
  nfTipo,
  setNfTipo,
  nfPage,
  setNfPage,
  NF_PER_PAGE,
  origemMeta,
  foundSet,
  foundMap,
  unidades,
  saveAtiva,
  onOpenItem,
  isMob,
  inp,
  cd,
  bs,
}) {
  const [expandedNf, setExpandedNf] = React.useState(null);
  const [expandedSearch, setExpandedSearch] = React.useState("");
  const defExpandedSearch = React.useDeferredValue(expandedSearch);
  const defNfSearch = React.useDeferredValue(nfSearch);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Notas Fiscais</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{nfDataList.length} nota(s) no total</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "2fr 1fr", gap: 8, marginBottom: 12 }}>
        <TInput
          initial={nfSearch}
          onVal={(v) => {
            setNfSearch(v);
            setNfPage(1);
          }}
          placeholder="Buscar NF ou fornecedor..."
          style={inp}
        />
        <select
          value={nfTipo}
          onChange={(e) => {
            setNfTipo(e.target.value);
            setNfPage(1);
          }}
          style={inp}
        >
          {["Todos", "Próprio", "Doação", "Incorporado"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {(() => {
        const term = defNfSearch.toLowerCase().trim();
        const list = nfDataList.filter((n) => {
          const tipoOk = nfTipo === "Todos" || (n.tipoEntrada || "Próprio") === nfTipo;
          const txtOk = !term || String(n.nf || "").toLowerCase().includes(term) || String(n.fornecedor || "").toLowerCase().includes(term);
          return tipoOk && txtOk;
        });

        const totalNfPages = Math.max(1, Math.ceil(list.length / NF_PER_PAGE));
        const curPage = Math.min(nfPage, totalNfPages);
        const pagedNf = list.slice((curPage - 1) * NF_PER_PAGE, curPage * NF_PER_PAGE);

        return (
          <>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>{list.length} nota(s) encontrada(s)</p>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(420px, 1fr))", gap: 10 }}>
              {pagedNf.map((n) => {
                const meta = origemMeta[n.tipoEntrada || "Próprio"] || origemMeta["Próprio"];
                const inv = n.itens.filter((i) => foundSet.has(i.id)).length;
                const pct = n.itens.length > 0 ? Math.round((inv / n.itens.length) * 100) : 0;

                return (
                  <div key={n.nf} style={{ ...cd, border: "1.5px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>NF {n.nf}</p>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800, background: meta.bg, color: meta.tx }}>
                            {n.tipoEntrada || "Próprio"}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.fornecedor || "—"}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                          {n.dataNF || "—"} · {n.itens.length} item(ns)
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#16a34a" }}>R$ {n.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>Atual: R$ {n.valorAtualTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Inventário</span>
                        <span style={{ fontSize: 11, color: "#1351B4", fontWeight: 800 }}>
                          {inv}/{n.itens.length} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0" }}>
                        <div style={{ height: "100%", borderRadius: 3, background: pct === 100 ? "#16a34a" : "#1351B4", width: `${pct}%`, transition: "width .2s" }} />
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      {(() => {
                        const isExpanded = expandedNf === n.nf;
                        let displayItens = n.itens;
                        if (isExpanded) {
                          const q = defExpandedSearch.trim().toLowerCase();
                          if (q) {
                            displayItens = displayItens.filter((i) => {
                              const fEntry = foundMap[i.id];
                              const desc = getDisplayDesc(i, fEntry).toLowerCase();
                              return String(i.id || "").toLowerCase().includes(q) || desc.includes(q);
                            });
                          }
                        } else {
                          displayItens = displayItens.slice(0, 4);
                        }

                        return (
                          <>
                            {isExpanded && (
                              <div style={{ marginBottom: 4 }}>
                                <TInput
                                  initial={expandedSearch}
                                  onVal={setExpandedSearch}
                                  placeholder="Buscar item nesta NF..."
                                  style={{ ...inp, padding: "6px 10px", fontSize: 12 }}
                                />
                              </div>
                            )}
                            <div style={{ maxHeight: isExpanded ? 300 : "none", overflowY: isExpanded ? "auto" : "visible", display: "grid", gap: 6, paddingRight: isExpanded ? 4 : 0 }}>
                              {displayItens.map((i) => {
                                const fEntry = foundMap[i.id];
                                const isPermutaNF = fEntry?.situacao === "Permuta";
                                return (
                                  <div
                                    key={i.id}
                                    onClick={() => {
                                      const u = unidades.find((x) => x.id === i.unidadeId);
                                      if (u) saveAtiva(u);
                                      onOpenItem(i);
                                    }}
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      alignItems: "center",
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      cursor: "pointer",
                                      border: `1px solid ${isPermutaNF ? "#fcd34d" : foundSet.has(i.id) ? "#bbf7d0" : "#e2e8f0"}`,
                                      background: isPermutaNF ? "#fefce8" : foundSet.has(i.id) ? "#f0fdf4" : "#fff",
                                    }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {getDisplayDesc(i, fEntry)}
                                      </p>
                                      {isPermutaNF && fEntry?.permutaDesc && <p style={{ margin: "1px 0 0", fontSize: 10, color: "#92400e", fontWeight: 700 }}>Permuta real: {fEntry.permutaDesc}</p>}
                                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>Nº {i.id} · {i.unidadeNome}</p>
                                    </div>
                                  </div>
                                );
                              })}
                              {isExpanded && displayItens.length === 0 && (
                                <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", margin: "10px 0" }}>Nenhum item corresponde à busca.</p>
                              )}
                            </div>
                            
                            {n.itens.length > 4 && (
                              <button
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedNf(null);
                                  } else {
                                    setExpandedNf(n.nf);
                                    setExpandedSearch("");
                                  }
                                }}
                                style={{ ...bs, width: "100%", marginTop: 4, padding: "6px 0", fontSize: 11, border: "none", background: "#f1f5f9", color: "#475569", fontWeight: 700 }}
                              >
                                {isExpanded ? "Fechar" : `Ver todos os ${n.itens.length} itens`}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalNfPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => setNfPage(1)} disabled={curPage === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                  «
                </button>
                <button onClick={() => setNfPage((p) => Math.max(1, p - 1))} disabled={curPage === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                  ‹
                </button>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Pág {curPage}/{totalNfPages}
                </span>
                <button onClick={() => setNfPage((p) => Math.min(totalNfPages, p + 1))} disabled={curPage === totalNfPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                  ›
                </button>
                <button onClick={() => setNfPage(totalNfPages)} disabled={curPage === totalNfPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                  »
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

