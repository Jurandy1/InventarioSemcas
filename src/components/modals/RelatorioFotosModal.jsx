import React, { useEffect, useMemo, useRef, useState } from "react";
import { Overlay } from "../Overlay.jsx";
import { SmartImg } from "../SmartImg.jsx";
import { CATEGORY_TREE, getCategoryGroup } from "../../constants/categories.js";
import { gerarRelatorioFotosCategorias } from "../../services/features.js";

function cleanUnidade(nome) {
  return String(nome || "").replace(/^\d+[\d.]*\s*-\s*/, "") || "—";
}

export function RelatorioFotosModal({
  isMob,
  onClose,
  todosItens,
  foundMap,
  foundSet,
  locais = [],
  initialCategorias = [],
  initialView = "preview",
  bp,
  bs,
  showT,
  onViewImage,
}) {
  const [selectedCats, setSelectedCats] = useState(() => {
    if (initialCategorias?.length) return new Set(initialCategorias);
    return new Set(CATEGORY_TREE.map((c) => c.name));
  });
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set());
  const [somenteComFoto, setSomenteComFoto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [view, setView] = useState(initialView === "categorias" ? "categorias" : "preview");
  const [itemQ, setItemQ] = useState("");
  const prevCandidateKey = useRef("");

  const localNomeById = useMemo(() => {
    const m = new Map();
    for (const l of locais || []) {
      const id = l?.id || l?._id;
      if (id) m.set(id, l.nome || id);
    }
    return m;
  }, [locais]);

  const resolveLocal = (localId) => {
    if (!localId || localId === "sem-local") return "Sem local";
    return localNomeById.get(localId) || localId;
  };

  const counts = useMemo(() => {
    const m = {};
    for (const c of CATEGORY_TREE) m[c.name] = { total: 0, comFoto: 0 };
    for (const item of todosItens || []) {
      if (!foundSet?.has(item.id)) continue;
      const f = foundMap?.[item.id];
      if (!f) continue;
      const cat = getCategoryGroup(f.especieEdit || item.especie);
      if (!m[cat]) m[cat] = { total: 0, comFoto: 0 };
      m[cat].total += 1;
      if ((f.fotoUrls || []).length > 0) m[cat].comFoto += 1;
    }
    return m;
  }, [todosItens, foundMap, foundSet]);

  const candidateRows = useMemo(() => {
    const rows = [];
    for (const item of todosItens || []) {
      if (!foundSet?.has(item.id)) continue;
      const f = foundMap?.[item.id];
      if (!f) continue;
      const cat = getCategoryGroup(f.especieEdit || item.especie);
      if (!selectedCats.has(cat)) continue;
      const fotos = Array.isArray(f.fotoUrls) ? f.fotoUrls.filter(Boolean) : [];
      if (somenteComFoto && fotos.length === 0) continue;
      rows.push({
        key: `${item.unidadeId}_${item.id}`,
        id: String(item.id),
        codigo: item.patrimonioLabel || item.id || "—",
        desc: f.descricaoEdit || item.descricao || item.especie || "—",
        cat,
        unidade: cleanUnidade(f.unidadeNome || item.unidadeNome),
        local: resolveLocal(f.localId),
        estado: f.estado || "",
        foto: fotos[0] || "",
        fotoCount: fotos.length,
      });
    }
    rows.sort((a, b) => {
      const c = a.cat.localeCompare(b.cat, "pt-BR");
      if (c !== 0) return c;
      const u = a.unidade.localeCompare(b.unidade, "pt-BR");
      if (u !== 0) return u;
      return String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true });
    });
    return rows;
  }, [todosItens, foundMap, foundSet, selectedCats, somenteComFoto, localNomeById]);

  // Ao mudar categorias: seleciona todos os itens candidatos por padrão.
  useEffect(() => {
    const key = candidateRows.map((r) => r.id).join("|");
    if (key === prevCandidateKey.current) return;
    const prevKey = prevCandidateKey.current;
    prevCandidateKey.current = key;
    const ids = candidateRows.map((r) => r.id);

    setSelectedItemIds((prev) => {
      if (!ids.length) return new Set();
      // Primeira carga ou troca total de lista → marca todos
      if (!prevKey || prev.size === 0) return new Set(ids);

      const still = ids.filter((id) => prev.has(id));
      if (still.length === 0) return new Set(ids);

      // Mantém a escolha do usuário nos que ainda existem; não força os novos
      return new Set(still);
    });
  }, [candidateRows]);

  const filteredRows = useMemo(() => {
    const q = itemQ.trim().toLowerCase();
    if (!q) return candidateRows;
    return candidateRows.filter(
      (r) =>
        String(r.codigo).toLowerCase().includes(q) ||
        String(r.desc).toLowerCase().includes(q) ||
        String(r.unidade).toLowerCase().includes(q) ||
        String(r.local).toLowerCase().includes(q) ||
        String(r.cat).toLowerCase().includes(q)
    );
  }, [candidateRows, itemQ]);

  const selectedCount = useMemo(
    () => candidateRows.reduce((n, r) => n + (selectedItemIds.has(r.id) ? 1 : 0), 0),
    [candidateRows, selectedItemIds]
  );

  const toggleCat = (name) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAllCats = () => setSelectedCats(new Set(CATEGORY_TREE.map((c) => c.name)));
  const clearAllCats = () => setSelectedCats(new Set());

  const toggleItem = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllItems = () => setSelectedItemIds(new Set(candidateRows.map((r) => r.id)));
  const clearAllItems = () => setSelectedItemIds(new Set());
  const selectVisibleItems = () => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredRows) next.add(r.id);
      return next;
    });
  };

  const gerar = async () => {
    if (selectedCats.size === 0) {
      showT?.("Selecione ao menos uma categoria");
      return;
    }
    if (selectedCount === 0) {
      showT?.("Marque ao menos um item no passo Itens");
      setView("preview");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 1, label: "Preparando…" });
    try {
      const ids = candidateRows.filter((r) => selectedItemIds.has(r.id)).map((r) => r.id);
      const doc = await gerarRelatorioFotosCategorias({
        itens: todosItens,
        foundMap,
        categorias: [...selectedCats],
        itemIds: ids,
        somenteComFoto,
        locais,
        onProgress: setProgress,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`relatorio_fotos_${ids.length}-itens_${stamp}.pdf`);
      showT?.("Relatório PDF gerado");
      onClose?.();
    } catch (e) {
      showT?.(e?.message || "Erro ao gerar relatório");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Overlay isMobile={isMob} onClose={busy ? undefined : onClose}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Relatório com fotos</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          {view === "preview"
            ? "Marque só os itens que você quer no PDF."
            : "1º categorias → 2º escolha os itens → gerar PDF."}
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { key: "categorias", label: "1. Categorias" },
            { key: "preview", label: `2. Itens (${selectedCount})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={busy}
              onClick={() => setView(t.key)}
              style={{
                flex: 1,
                background: view === t.key ? "#1351B4" : "#f1f5f9",
                color: view === t.key ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {view === "categorias" ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={selectAllCats} disabled={busy} style={{ ...bs, padding: "6px 12px", fontSize: 12 }}>
                Todas
              </button>
              <button type="button" onClick={clearAllCats} disabled={busy} style={{ ...bs, padding: "6px 12px", fontSize: 12 }}>
                Limpar
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#374151", marginLeft: "auto", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={somenteComFoto}
                  disabled={busy}
                  onChange={(e) => setSomenteComFoto(e.target.checked)}
                />
                Só com foto
              </label>
            </div>

            <div
              style={{
                maxHeight: isMob ? "38vh" : 280,
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 8,
                marginBottom: 12,
              }}
            >
              {CATEGORY_TREE.map((cat) => {
                const c = counts[cat.name] || { total: 0, comFoto: 0 };
                const checked = selectedCats.has(cat.name);
                const n = somenteComFoto ? c.comFoto : c.total;
                return (
                  <label
                    key={cat.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: checked ? "#eff6ff" : "transparent",
                      cursor: busy ? "default" : "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <input type="checkbox" checked={checked} disabled={busy} onChange={() => toggleCat(cat.name)} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: checked ? 700 : 500, color: "#0f172a" }}>{cat.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: n ? "#1351B4" : "#94a3b8" }}>
                      {n} item{n === 1 ? "" : "s"}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={selectAllItems} disabled={busy || !candidateRows.length} style={{ ...bs, padding: "6px 12px", fontSize: 12 }}>
                Marcar todos
              </button>
              <button type="button" onClick={clearAllItems} disabled={busy} style={{ ...bs, padding: "6px 12px", fontSize: 12 }}>
                Desmarcar
              </button>
              {itemQ.trim() && (
                <button type="button" onClick={selectVisibleItems} disabled={busy || !filteredRows.length} style={{ ...bs, padding: "6px 12px", fontSize: 12 }}>
                  Marcar filtrados
                </button>
              )}
              <input
                value={itemQ}
                onChange={(e) => setItemQ(e.target.value)}
                disabled={busy}
                placeholder="Filtrar nº, descrição, unidade, local…"
                style={{
                  flex: 1,
                  minWidth: 140,
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 12,
                }}
              />
            </div>

            <div
              style={{
                maxHeight: isMob ? "48vh" : 360,
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 8,
                marginBottom: 12,
                background: "#f8fafc",
              }}
            >
              {filteredRows.length === 0 ? (
                <p style={{ margin: 16, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
                  {candidateRows.length === 0
                    ? "Nenhum item nas categorias. Volte em Categorias."
                    : "Nenhum item com esse filtro."}
                </p>
              ) : (
                filteredRows.map((row) => {
                  const checked = selectedItemIds.has(row.id);
                  return (
                    <label
                      key={row.key}
                      style={{
                        display: "flex",
                        gap: 10,
                        background: checked ? "#eff6ff" : "#fff",
                        border: `1.5px solid ${checked ? "#93c5fd" : "#e2e8f0"}`,
                        borderRadius: 10,
                        padding: 8,
                        marginBottom: 8,
                        cursor: busy ? "default" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleItem(row.id)}
                        style={{ marginTop: 4, flexShrink: 0 }}
                      />
                      <div
                        style={{
                          width: isMob ? 64 : 80,
                          height: isMob ? 64 : 80,
                          flexShrink: 0,
                          borderRadius: 8,
                          overflow: "hidden",
                          background: row.foto ? "#0f172a" : "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onClick={(e) => {
                          if (row.foto && onViewImage) {
                            e.preventDefault();
                            onViewImage(row.foto);
                          }
                        }}
                      >
                        {row.foto ? (
                          <SmartImg src={row.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>SEM FOTO</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Nº {row.codigo}</p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "#334155",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.desc}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 700, color: "#1351B4" }}>{row.cat}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#0f172a", fontWeight: 600 }}>Unidade: {row.unidade}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569" }}>Local: {row.local}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}

        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#475569" }}>
          {selectedCats.size} categoria(s) · <strong>{selectedCount}</strong> de {candidateRows.length} item(ns) no PDF
        </p>

        {busy && progress && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#1351B4", transition: "width .2s" }} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
              Gerando… {progress.done}/{progress.total}
              {progress.label ? ` · ${progress.label}` : ""}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...bs, flex: 1, minWidth: 100 }}>
            Cancelar
          </button>
          {view === "categorias" ? (
            <button
              type="button"
              onClick={() => setView("preview")}
              disabled={busy || candidateRows.length === 0}
              style={{ ...bs, flex: 1, minWidth: 100, borderColor: "#1351B4", color: "#1351B4" }}
            >
              Escolher itens →
            </button>
          ) : (
            <button type="button" onClick={() => setView("categorias")} disabled={busy} style={{ ...bs, flex: 1, minWidth: 100 }}>
              ← Categorias
            </button>
          )}
          <button
            type="button"
            onClick={gerar}
            disabled={busy || selectedCount === 0}
            style={{
              ...bp,
              flex: 1.2,
              minWidth: 120,
              opacity: busy || selectedCount === 0 ? 0.55 : 1,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Gerando PDF…" : `Gerar PDF (${selectedCount})`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
