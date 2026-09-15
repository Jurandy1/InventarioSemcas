import React, { useEffect, useMemo, useState } from "react";
import { Overlay } from "../Overlay.jsx";
import {
  buildItemExportRows,
  DEFAULT_ITEM_EXPORT_COLUMNS,
  gerarPlanilhaItens,
  ITEM_EXPORT_COLUMNS,
  REQUIRED_ITEM_EXPORT_COLUMNS,
} from "../../services/exportItensExcel.js";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function PlanilhaItensModal({
  isMob,
  onClose,
  itens,
  foundMap,
  foundSet,
  unidades,
  locais,
  bp,
  bs,
  showT,
}) {
  const rows = useMemo(
    () => buildItemExportRows({ itens, foundMap, foundSet, unidades, locais }),
    [itens, foundMap, foundSet, unidades, locais]
  );
  const [step, setStep] = useState("categorias");
  const [query, setQuery] = useState("");
  const [somenteEncontrados, setSomenteEncontrados] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(() => new Set());
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [selectedColumns, setSelectedColumns] = useState(() => new Set(DEFAULT_ITEM_EXPORT_COLUMNS));
  const [separarPorCategoria, setSepararPorCategoria] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedColumns((current) => {
      const next = new Set(current);
      let changed = false;
      for (const key of REQUIRED_ITEM_EXPORT_COLUMNS) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  const eligibleRows = useMemo(
    () => somenteEncontrados ? rows.filter((row) => row.statusInventario === "Inventariado") : rows,
    [rows, somenteEncontrados]
  );

  const categories = useMemo(() => {
    const counts = new Map();
    eligibleRows.forEach((row) => counts.set(row.categoria || "Sem categoria", (counts.get(row.categoria || "Sem categoria") || 0) + 1));
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [eligibleRows]);

  useEffect(() => {
    setSelectedCategories(new Set(categories.map((category) => category.name)));
  }, [categories]);

  const candidateRows = useMemo(
    () => eligibleRows.filter((row) => selectedCategories.has(row.categoria || "Sem categoria")),
    [eligibleRows, selectedCategories]
  );

  useEffect(() => {
    setSelectedItems(new Set(candidateRows.map((row) => row._selectionKey)));
  }, [candidateRows]);

  const visibleRows = useMemo(() => {
    const q = normalizeSearch(query).trim();
    if (!q) return candidateRows;
    const terms = q.split(/\s+/).filter(Boolean);
    return candidateRows.filter((row) => {
      const haystack = normalizeSearch([
        row.idInterno,
        row.tipoRegistro,
        row.patrimonio,
        row.idRegistro,
        row.descricao,
        row.marca,
        row.unidadeCadastrada,
        row.unidadeEncontrada,
        row.local,
        row.statusInventario,
      ].join(" "));
      return terms.every((term) => haystack.includes(term));
    });
  }, [candidateRows, query]);

  const groupedColumns = useMemo(() => {
    const groups = new Map();
    for (const column of ITEM_EXPORT_COLUMNS) {
      if (!groups.has(column.group)) groups.set(column.group, []);
      groups.get(column.group).push(column);
    }
    return [...groups.entries()];
  }, []);

  const toggleItem = (key) => {
    setSelectedItems((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (name) => {
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const markVisible = () => {
    setSelectedItems((current) => {
      const next = new Set(current);
      visibleRows.forEach((row) => next.add(row._selectionKey));
      return next;
    });
  };

  const selectPreset = (keys) => {
    const next = new Set(REQUIRED_ITEM_EXPORT_COLUMNS);
    for (const key of keys || []) next.add(key);
    setSelectedColumns(next);
  };

  const toggleColumn = (key) => {
    if (REQUIRED_ITEM_EXPORT_COLUMNS.includes(key)) return;
    setSelectedColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportFile = async () => {
    const selectedRows = candidateRows.filter((row) => selectedItems.has(row._selectionKey));
    if (!selectedRows.length) {
      showT?.("Selecione pelo menos um item");
      setStep("itens");
      return;
    }
    if (!selectedColumns.size) {
      showT?.("Selecione pelo menos uma coluna");
      setStep("colunas");
      return;
    }
    setBusy(true);
    try {
      await gerarPlanilhaItens({
        rows: selectedRows,
        columnKeys: ITEM_EXPORT_COLUMNS.filter((column) => selectedColumns.has(column.key)).map((column) => column.key),
        separarPorCategoria,
      });
      showT?.("Planilha Excel gerada");
      onClose?.();
    } catch (error) {
      showT?.(error?.message || "Não foi possível gerar a planilha");
    } finally {
      setBusy(false);
    }
  };

  const selectedItemCount = selectedItems.size;
  const selectedCategoryCount = selectedCategories.size;
  const selectedColumnCount = selectedColumns.size;

  return (
    <Overlay
      isMobile={isMob}
      onClose={busy ? undefined : onClose}
      panelStyle={isMob ? undefined : { width: "min(760px, calc(100vw - 32px))", maxWidth: 760 }}
    >
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Planilha de itens</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          Exporte os resultados dos filtros atuais e escolha exatamente os itens e cabeçalhos da planilha.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", marginBottom: 12, border: "1px solid #bfdbfe", borderRadius: 9, background: "#eff6ff", flexWrap: "wrap" }}>
          <span style={{ color: "#1e3a8a", fontSize: 12, fontWeight: 700 }}>Filtrar inventário:</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSomenteEncontrados(false)}
            style={{
              ...bs,
              width: "auto",
              padding: "6px 11px",
              fontSize: 12,
              background: !somenteEncontrados ? "#1351B4" : "#fff",
              color: !somenteEncontrados ? "#fff" : "#334155",
              borderColor: !somenteEncontrados ? "#1351B4" : "#cbd5e1",
            }}
          >
            Todos ({rows.length})
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSomenteEncontrados(true)}
            style={{
              ...bs,
              width: "auto",
              padding: "6px 11px",
              fontSize: 12,
              background: somenteEncontrados ? "#15803d" : "#fff",
              color: somenteEncontrados ? "#fff" : "#166534",
              borderColor: somenteEncontrados ? "#15803d" : "#86efac",
            }}
          >
            Somente encontrados ({rows.filter((row) => row.statusInventario === "Inventariado").length})
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { key: "categorias", label: `1. Categorias (${selectedCategoryCount})` },
            { key: "itens", label: `2. Itens (${selectedItemCount})` },
            { key: "colunas", label: `3. Colunas (${selectedColumnCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              disabled={busy}
              onClick={() => setStep(tab.key)}
              style={{
                flex: 1,
                background: step === tab.key ? "#1351B4" : "#f1f5f9",
                color: step === tab.key ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                padding: "9px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {step === "categorias" ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={busy || !categories.length} onClick={() => setSelectedCategories(new Set(categories.map((category) => category.name)))} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Todas
              </button>
              <button type="button" disabled={busy} onClick={() => setSelectedCategories(new Set())} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Limpar
              </button>
            </div>
            <div style={{ maxHeight: isMob ? "48vh" : 390, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, background: "#f8fafc" }}>
              {categories.map((category) => {
                const checked = selectedCategories.has(category.name);
                return (
                  <label key={category.name} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px", marginBottom: 6, borderRadius: 9, border: `1.5px solid ${checked ? "#93c5fd" : "#e2e8f0"}`, background: checked ? "#eff6ff" : "#fff", cursor: busy ? "default" : "pointer" }}>
                    <input type="checkbox" checked={checked} disabled={busy} onChange={() => toggleCategory(category.name)} />
                    <strong style={{ flex: 1, fontSize: 13, color: "#0f172a" }}>{category.name}</strong>
                    <span style={{ fontSize: 11, color: "#1351B4", fontWeight: 700 }}>{category.count} item(ns)</span>
                  </label>
                );
              })}
            </div>
          </>
        ) : step === "itens" ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={busy || !candidateRows.length} onClick={() => setSelectedItems(new Set(candidateRows.map((row) => row._selectionKey)))} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Marcar todos
              </button>
              <button type="button" disabled={busy} onClick={() => setSelectedItems(new Set())} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Desmarcar
              </button>
              {query.trim() && (
                <button type="button" disabled={busy || !visibleRows.length} onClick={markVisible} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                  Marcar filtrados
                </button>
              )}
              <input
                value={query}
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar ID interno, tipo, nº, descrição…"
                style={{ flex: 1, minWidth: 220, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}
              />
            </div>

            <div style={{ maxHeight: isMob ? "48vh" : 390, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, background: "#f8fafc" }}>
              {!visibleRows.length ? (
                <p style={{ margin: 18, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Nenhum item encontrado.</p>
              ) : visibleRows.map((row) => {
                const checked = selectedItems.has(row._selectionKey);
                return (
                  <label key={row._selectionKey} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", marginBottom: 6, borderRadius: 9, border: `1.5px solid ${checked ? "#93c5fd" : "#e2e8f0"}`, background: checked ? "#eff6ff" : "#fff", cursor: busy ? "default" : "pointer" }}>
                    <input type="checkbox" checked={checked} disabled={busy} onChange={() => toggleItem(row._selectionKey)} style={{ marginTop: 3 }} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", color: "#0f172a", fontSize: 12 }}>Nº {row.patrimonio || "—"} — {row.descricao || "Sem descrição"}</strong>
                      <span style={{ display: "block", marginTop: 2, color: "#1351B4", fontSize: 11, fontWeight: 700 }}>
                        {row.tipoRegistro || "—"}
                        {row.idInterno ? ` · ${row.idInterno}` : ""}
                      </span>
                      <span style={{ display: "block", marginTop: 2, color: "#475569", fontSize: 11, whiteSpace: "normal", overflowWrap: "anywhere" }}>
                        {row.marca ? `${row.marca} · ` : ""}{row.unidadeEncontrada || row.unidadeCadastrada || "Sem unidade"}{row.local ? ` · ${row.local}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button type="button" disabled={busy} onClick={() => selectPreset(["descricao"])} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Somente descrição (+ IDs)
              </button>
              <button type="button" disabled={busy} onClick={() => selectPreset(DEFAULT_ITEM_EXPORT_COLUMNS)} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Campos principais
              </button>
              <button type="button" disabled={busy} onClick={() => selectPreset(ITEM_EXPORT_COLUMNS.map((column) => column.key))} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Todos os campos
              </button>
              <button type="button" disabled={busy} onClick={() => selectPreset([])} style={{ ...bs, padding: "7px 12px", fontSize: 12 }}>
                Só IDs obrigatórios
              </button>
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
              Cabeçalhos obrigatórios: ID interno e Tipo de registro (sempre saem na planilha).
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", marginBottom: 10, borderRadius: 8, background: "#ecfdf5", color: "#166534", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
              <input type="checkbox" checked={separarPorCategoria} disabled={busy} onChange={(event) => setSepararPorCategoria(event.target.checked)} />
              Criar uma aba separada no Excel para cada categoria
            </label>

            <div style={{ maxHeight: isMob ? "48vh" : 390, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
              {groupedColumns.map(([group, columns]) => (
                <section key={group} style={{ marginBottom: 14 }}>
                  <h3 style={{ margin: "0 0 7px", fontSize: 12, color: "#1351B4", textTransform: "uppercase", letterSpacing: ".04em" }}>{group}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                    {columns.map((column) => {
                      const required = REQUIRED_ITEM_EXPORT_COLUMNS.includes(column.key);
                      const checked = required || selectedColumns.has(column.key);
                      return (
                        <label key={column.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 8, border: `1px solid ${checked ? "#93c5fd" : "#e2e8f0"}`, background: checked ? "#eff6ff" : "#fff", color: "#1e293b", fontSize: 12, fontWeight: checked ? 700 : 500, cursor: busy || required ? "default" : "pointer", opacity: required ? 0.95 : 1 }}>
                          <input type="checkbox" checked={checked} disabled={busy || required} onChange={() => toggleColumn(column.key)} />
                          {column.label}{required ? " *" : ""}
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <p style={{ margin: "10px 0", fontSize: 12, color: "#475569" }}>
          <strong>{selectedCategoryCount}</strong> categoria(s), <strong>{selectedItemCount}</strong> item(ns) e <strong>{selectedColumnCount}</strong> coluna(s) serão exportados.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" disabled={busy} onClick={onClose} style={{ ...bs, minWidth: 110 }}>Cancelar</button>
          {step === "categorias" && (
            <button type="button" disabled={busy || !selectedCategoryCount} onClick={() => setStep("itens")} style={{ ...bs, minWidth: 140, borderColor: "#1351B4", color: "#1351B4" }}>
              Escolher itens →
            </button>
          )}
          {step === "itens" && (
            <button type="button" disabled={busy || !selectedItemCount} onClick={() => setStep("colunas")} style={{ ...bs, minWidth: 140, borderColor: "#1351B4", color: "#1351B4" }}>
              Escolher colunas →
            </button>
          )}
          <button type="button" disabled={busy || !selectedItemCount || !selectedColumnCount} onClick={exportFile} style={{ ...bp, minWidth: 170, opacity: busy || !selectedItemCount || !selectedColumnCount ? 0.55 : 1 }}>
            {busy ? "Gerando…" : `Gerar Excel (${selectedItemCount})`}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
