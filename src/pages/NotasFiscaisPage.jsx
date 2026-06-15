import React from "react";
import MiniSearch from "minisearch";
import { VirtuosoGrid } from "react-virtuoso";
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
          }}
          style={inp}
        >
          {["Todos", "Próprio", "Doação", "Incorporado"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {(() => {
        const miniSearchNF = React.useMemo(() => {
          const ms = new MiniSearch({
            fields: ["nf", "fornecedor"],
            storeFields: ["nf"],
            searchOptions: { prefix: true, fuzzy: 0.2 },
            tokenize: (str) => str.toLowerCase().split(/[\s,]+/),
          });
          ms.addAll(nfDataList.map((n) => ({ id: n.nf, nf: n.nf, fornecedor: n.fornecedor })));
          return ms;
        }, [nfDataList]);

        const searchResultsNf = React.useMemo(() => {
          const q = defNfSearch.toLowerCase().trim();
          if (!q) return null;
          return new Set(miniSearchNF.search(q).map((r) => r.id));
        }, [miniSearchNF, defNfSearch]);

        const list = nfDataList.filter((n) => {
          const tipoOk = nfTipo === "Todos" || (n.tipoEntrada || "Próprio") === nfTipo;
          if (searchResultsNf) return tipoOk && searchResultsNf.has(n.nf);
          return tipoOk;
        });

        return (
          <>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>{list.length} nota(s) encontrada(s)</p>
            <VirtuosoGrid
              useWindowScroll
              totalCount={list.length}
              components={{
                List: React.forwardRef(({ style, children, ...props }, ref) => (
                  <div ref={ref} {...props} style={{ ...style, display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(420px, 1fr))", gap: 10 }}>
                    {children}
                  </div>
                )),
                Item: ({ children, ...props }) => <div {...props}>{children}</div>,
              }}
              itemContent={(index) => {
                const n = list[index];
                const meta = origemMeta[n.tipoEntrada || "Próprio"] || origemMeta["Próprio"];
                const inv = n.itens.filter((i) => foundSet.has(i.id)).length;
                const pct = n.itens.length > 0 ? Math.round((inv / n.itens.length) * 100) : 0;
                
                const displayItens = n.itens.slice(0, 2);

                return (
                  <div
                    key={n.nf}
                    onClick={() => setExpandedNf(n)}
                    style={{ ...cd, border: "1.5px solid #e2e8f0", cursor: "pointer", transition: "transform 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                  >
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
                      {displayItens.map((i) => {
                        const fEntry = foundMap[i.id];
                        const isPermutaNF = fEntry?.situacao === "Permuta";
                        return (
                          <div
                            key={i.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const u = unidades.find((x) => x.id === i.unidadeId);
                              if (u) saveAtiva(u);
                              onOpenItem(i);
                            }}
                            style={{
                              display: "flex", gap: 10, alignItems: "center", padding: "8px 10px",
                              borderRadius: 10, cursor: "pointer",
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
                      {n.itens.length > 2 && (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#1351B4", fontWeight: 700, textAlign: "center" }}>
                          + {n.itens.length - 2} itens... (Clique na nota para ver mais)
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {expandedNf && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 9999,
                  background: "rgba(15, 23, 42, 0.7)", display: "flex",
                  alignItems: "center", justifyContent: "center", padding: 16
                }}
                onClick={() => {
                  setExpandedNf(null);
                  setExpandedSearch("");
                }}
              >
                <div
                  style={{
                    background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600,
                    maxHeight: "85vh", display: "flex", flexDirection: "column",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>NF {expandedNf.nf}</h3>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>{expandedNf.fornecedor || "—"}</p>
                    </div>
                    <button
                      onClick={() => { setExpandedNf(null); setExpandedSearch(""); }}
                      style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#64748b", padding: 4 }}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div style={{ padding: "12px 20px" }}>
                    <TInput
                      initial={expandedSearch}
                      onVal={setExpandedSearch}
                      placeholder="Buscar item nesta NF..."
                      style={{ ...inp, padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", display: "grid", gap: 8 }}>
                    {(() => {
                      const q = defExpandedSearch.trim().toLowerCase();
                      let items = expandedNf.itens;
                      if (q) {
                        items = items.filter((i) => {
                          const fEntry = foundMap[i.id];
                          const desc = getDisplayDesc(i, fEntry).toLowerCase();
                          return String(i.id || "").toLowerCase().includes(q) || desc.includes(q);
                        });
                      }

                      if (items.length === 0) return <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 20 }}>Nenhum item corresponde à busca.</p>;

                      return items.map((i) => {
                        const fEntry = foundMap[i.id];
                        const isPermutaNF = fEntry?.situacao === "Permuta";
                        return (
                          <div
                            key={i.id}
                            onClick={() => {
                              setExpandedNf(null);
                              setExpandedSearch("");
                              const u = unidades.find((x) => x.id === i.unidadeId);
                              if (u) saveAtiva(u);
                              onOpenItem(i);
                            }}
                            style={{
                              display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                              borderRadius: 10, cursor: "pointer",
                              border: `1px solid ${isPermutaNF ? "#fcd34d" : foundSet.has(i.id) ? "#bbf7d0" : "#e2e8f0"}`,
                              background: isPermutaNF ? "#fefce8" : foundSet.has(i.id) ? "#f0fdf4" : "#fff",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                                {getDisplayDesc(i, fEntry)}
                              </p>
                              {isPermutaNF && fEntry?.permutaDesc && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#92400e", fontWeight: 700 }}>Permuta real: {fEntry.permutaDesc}</p>}
                              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Nº {i.id} · {i.unidadeNome}</p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

