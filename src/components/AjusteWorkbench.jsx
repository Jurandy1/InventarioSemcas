import React, { useMemo, useState } from "react";
import { Badge } from "./Badge.jsx";
import { TInput } from "./FormFields.jsx";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { sortByDataNF } from "../utils/itemHelpers.js";
import { getAjusteSignals, rankTombosForAjuste, sortTombosByAjusteMatch } from "../utils/ajusteMatch.js";
import { isAjustePendente, isTomboPendente, showFotoManualBadge } from "../utils/semTombo.js";

const TIPO_ENTRADA_BADGE = {
  Próprio: { bg: "#dbeafe", tx: "#1d4ed8" },
  Incorporado: { bg: "#ede9fe", tx: "#6d28d9" },
  Doação: { bg: "#fce7f3", tx: "#be185d" },
  Permuta: { bg: "#fef3c7", tx: "#92400e" },
};

function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}

function formatNfLabel(item) {
  const raw = String(item?.nf || "").trim();
  if (!raw) return "NF —";
  return raw.toLowerCase().startsWith("nf") ? raw : `NF ${raw}`;
}

function buildOrigemLine(item) {
  const fornecedor = String(item?.fornecedor || "").trim() || "—";
  const empenho = String(item?.empenho || "").trim() || "NÃO INFORMADO";
  const rawNf = String(item?.nf || "").trim();
  const nf = rawNf ? (rawNf.toLowerCase().startsWith("nf") ? rawNf : `NF ${rawNf}`) : "NF —";
  return `${fornecedor} · ${empenho} · ${nf}`;
}

/**
 * Painel duplo de ajuste: fotos sem tombo × tombos pendentes com match inteligente.
 * mode="pro" — filtros extras e mais sugestões (Finalizados).
 */
export function AjusteWorkbench({
  unidadesAtivas = [],
  foundSet,
  foundMap,
  isMob,
  cd,
  inp,
  bp,
  bs,
  onOpenSemTombo,
  onOpenFotoVarios,
  onOpenLinkTombo,
  onViewImage,
  mode = "standard",
  title,
  subtitle,
}) {
  const [ajusteTomboSearch, setAjusteTomboSearch] = useState("");
  const [selectedAjusteId, setSelectedAjusteId] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [minScoreView, setMinScoreView] = useState(mode === "pro" ? 10 : 15);

  const isPro = mode === "pro";
  const suggestionLimit = isPro ? 6 : 4;

  const ajusteItems = useMemo(() => {
    const out = [];
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        const f = foundMap[i.id];
        if (!f) continue;
        if (isAjustePendente(i, f)) out.push({ item: { ...i, unidadeId: u.id, unidadeNome: u.nome }, found: f });
      }
    }
    return out.sort((a, b) => String(a.found?.ultimaAtualizacao || "").localeCompare(String(b.found?.ultimaAtualizacao || "")));
  }, [unidadesAtivas, foundMap]);

  const tombosPendentes = useMemo(() => {
    const out = [];
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        if (!isTomboPendente(i, foundSet)) continue;
        out.push({ ...i, unidadeId: u.id, unidadeNome: u.nome });
      }
    }
    return out.sort(sortByDataNF);
  }, [unidadesAtivas, foundSet]);

  const ajusteSuggestionsById = useMemo(() => {
    const map = new Map();
    for (const row of ajusteItems) {
      map.set(row.item.id, rankTombosForAjuste(row.item, row.found, tombosPendentes, { minScore: minScoreView, limit: suggestionLimit }));
    }
    return map;
  }, [ajusteItems, tombosPendentes, minScoreView, suggestionLimit]);

  const selectedAjusteRow = useMemo(
    () => ajusteItems.find((r) => r.item.id === selectedAjusteId) || null,
    [ajusteItems, selectedAjusteId]
  );

  const marcasDisponiveis = useMemo(() => {
    const set = new Set();
    for (const t of tombosPendentes) {
      const m = String(t.marca || "").trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tombosPendentes]);

  const tombosPendentesFiltrados = useMemo(() => {
    const q = String(ajusteTomboSearch || "").trim().toLowerCase();
    const marcaQ = String(filtroMarca || "").trim().toLowerCase();
    const tipoQ = String(filtroTipo || "").trim();
    let base = tombosPendentes;
    if (q) {
      base = base.filter(
        (it) =>
          String(it.id || "").toLowerCase().includes(q) ||
          String(it.patrimonioLabel || "").toLowerCase().includes(q) ||
          String(it.descricao || "").toLowerCase().includes(q) ||
          String(it.especie || "").toLowerCase().includes(q) ||
          String(it.fornecedor || "").toLowerCase().includes(q) ||
          String(it.marca || "").toLowerCase().includes(q) ||
          String(it.nf || "").toLowerCase().includes(q) ||
          String(it.dataNF || "").toLowerCase().includes(q) ||
          String(it.tipoEntrada || "").toLowerCase().includes(q) ||
          String(it.empenho || "").toLowerCase().includes(q)
      );
    }
    if (marcaQ) base = base.filter((it) => String(it.marca || "").toLowerCase().includes(marcaQ));
    if (tipoQ) base = base.filter((it) => (it.tipoEntrada || "Próprio") === tipoQ);
    if (selectedAjusteRow) {
      return sortTombosByAjusteMatch(base, selectedAjusteRow.item, selectedAjusteRow.found);
    }
    return base;
  }, [tombosPendentes, ajusteTomboSearch, filtroMarca, filtroTipo, selectedAjusteRow]);

  const tomboMatchScores = useMemo(() => {
    if (!selectedAjusteRow) return new Map();
    return new Map(
      rankTombosForAjuste(selectedAjusteRow.item, selectedAjusteRow.found, tombosPendentes, {
        minScore: 0,
        limit: Infinity,
      }).map((r) => [r.item.id, r])
    );
  }, [selectedAjusteRow, tombosPendentes]);

  const autoMatchCount = useMemo(() => {
    let n = 0;
    for (const row of ajusteItems) {
      const top = ajusteSuggestionsById.get(row.item.id)?.[0];
      if (top?.score >= 40) n++;
    }
    return n;
  }, [ajusteItems, ajusteSuggestionsById]);

  return (
    <div>
      <div style={{ ...cd, marginBottom: 12, border: isPro ? "1.5px solid #c4b5fd" : "1px solid #e2e8f0", background: isPro ? "#faf5ff" : "#fff" }}>
        <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
          {title || (isPro ? "Central de ligação — mobiliário e tombos" : "Ajuste — identificar por foto")}
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          {subtitle ||
            (isPro
              ? "Ferramenta avançada para vincular fotos aos tombos corretos. Use filtros por marca e tipo; matches com 40%+ podem ser vinculados em um clique."
              : "Itens registrados só com foto ficam aqui até ligar ao tombo correto da planilha.")}
        </p>
        {isPro && autoMatchCount > 0 && (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: "#ecfdf5", border: "1px solid #86efac", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#15803d" }}>
              {autoMatchCount} item(ns) com match forte (≥40%) — selecione à esquerda e confirme o vínculo.
            </p>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onOpenSemTombo && (
            <button onClick={() => onOpenSemTombo?.()} style={{ ...bp, fontSize: 12, padding: "8px 14px" }}>
              + Foto e descrição
            </button>
          )}
          {onOpenFotoVarios && (
            <button onClick={() => onOpenFotoVarios?.()} style={{ ...bs, fontSize: 12, padding: "8px 14px", borderColor: "#1351B4", color: "#1351B4" }}>
              Mesma foto em vários tombos
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={{ ...cd, border: "1.5px solid #fcd34d" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: "#92400e" }}>
            Fotos aguardando identificação ({ajusteItems.length})
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: "#a16207", lineHeight: 1.4 }}>
            Clique para priorizar matches. {isPro ? "Sugestões consideram marca, espécie, NF e empenho." : "Compara marca e descrição com tombos pendentes."}
          </p>
          {ajusteItems.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 8px" }}>
              Nenhuma foto pendente de identificação.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: isPro ? 520 : 420, overflowY: "auto" }}>
              {ajusteItems.map(({ item, found: f }) => {
                const foto = f?.fotoUrls?.[0];
                const signals = getAjusteSignals(item, f);
                const suggestions = ajusteSuggestionsById.get(item.id) || [];
                const isSelected = selectedAjusteId === item.id;
                const topScore = suggestions[0]?.score || 0;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedAjusteId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedAjusteId(item.id);
                    }}
                    style={{
                      border: `1.5px solid ${isSelected ? "#1351B4" : topScore >= 40 ? "#86efac" : "#fde68a"}`,
                      borderRadius: 10,
                      padding: 10,
                      background: isSelected ? "#eff6ff" : topScore >= 40 ? "#f0fdf4" : "#fffbeb",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {foto ? (
                        <PhotoThumb src={foto} badge={showFotoManualBadge(item, f)} size={52} onImageClick={() => onViewImage?.(foto)} />
                      ) : (
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#92400e", flexShrink: 0 }}>
                          S/T
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{getDisplayDesc(item, f)}</p>
                        {signals.marca ? (
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Marca: {signals.marca}</p>
                        ) : null}
                        {f?.tomboReferencia && (
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#92400e" }}>Tombo indicado: {f.tomboReferencia}</p>
                        )}
                        {unidadesAtivas.length > 1 && (
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b" }}>{item.unidadeNome}</p>
                        )}
                        {topScore >= 15 && (
                          <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, color: topScore >= 40 ? "#15803d" : "#1351B4" }}>
                            Melhor match: {topScore}%
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAjusteId(item.id);
                          onOpenLinkTombo?.(item, f, suggestions[0]?.item?.id);
                        }}
                        style={{ ...bp, padding: "8px 10px", fontSize: 11, flexShrink: 0 }}
                      >
                        Vincular
                      </button>
                    </div>
                    {suggestions.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #fcd34d" }}>
                        <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "#1351B4", textTransform: "uppercase", letterSpacing: 0.4 }}>
                          Possível match na planilha
                        </p>
                        <div style={{ display: "grid", gap: 6 }}>
                          {suggestions.map(({ item: cand, score, reasons }) => (
                            <button
                              key={cand.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAjusteId(item.id);
                                onOpenLinkTombo?.(item, f, cand.id);
                              }}
                              style={{
                                textAlign: "left",
                                border: score >= 40 ? "1.5px solid #86efac" : "1px solid #bfdbfe",
                                borderRadius: 8,
                                padding: "8px 10px",
                                background: score >= 40 ? "#f0fdf4" : "#fff",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#0f172a" }}>{cand.descricao || cand.especie || "—"}</p>
                                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b" }}>
                                    Nº {getItemCode(cand)} · {cand.fornecedor || "—"}
                                    {cand.marca ? ` · ${cand.marca}` : ""}
                                  </p>
                                </div>
                                <Badge label={`${score}%`} c={{ bg: score >= 60 ? "#dcfce7" : "#dbeafe", tx: score >= 60 ? "#15803d" : "#1d4ed8" }} />
                              </div>
                              {reasons?.length > 0 && (
                                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#64748b" }}>Coincidência: {reasons.join(", ")}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ ...cd, border: "1.5px solid #fed7aa" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: "#c2410c" }}>
            Tombos ainda não encontrados ({tombosPendentes.length})
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#9a3412", lineHeight: 1.4 }}>
            {selectedAjusteRow
              ? "Ordenado por compatibilidade com o item selecionado."
              : "Selecione um item à esquerda para priorizar matches inteligentes."}
          </p>
          {isPro && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} style={{ ...inp, flex: "1 1 120px", fontSize: 12, padding: "8px 10px" }}>
                <option value="">Todas as marcas</option>
                {marcasDisponiveis.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ ...inp, flex: "1 1 100px", fontSize: 12, padding: "8px 10px" }}>
                <option value="">Todos os tipos</option>
                {["Próprio", "Incorporado", "Doação", "Permuta"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select value={minScoreView} onChange={(e) => setMinScoreView(Number(e.target.value))} style={{ ...inp, flex: "1 1 100px", fontSize: 12, padding: "8px 10px" }}>
                <option value={8}>Sugestões ≥8%</option>
                <option value={10}>Sugestões ≥10%</option>
                <option value={15}>Sugestões ≥15%</option>
                <option value={25}>Sugestões ≥25%</option>
              </select>
            </div>
          )}
          <TInput initial={ajusteTomboSearch} onVal={setAjusteTomboSearch} placeholder="Buscar tombo, NF, descrição, empenho..." style={{ ...inp, marginBottom: 10, fontSize: 12 }} />
          {tombosPendentesFiltrados.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 8px" }}>
              {tombosPendentes.length === 0 ? "Todos os tombos desta unidade já foram inventariados." : "Nenhum resultado na busca."}
            </p>
          ) : (
            <div style={{ maxHeight: isPro ? 520 : 420, overflowY: "auto", display: "grid", gap: 6 }}>
              {tombosPendentesFiltrados.map((it) => {
                const tipo = it.tipoEntrada || "Próprio";
                const tipoC = TIPO_ENTRADA_BADGE[tipo] || TIPO_ENTRADA_BADGE["Próprio"];
                const match = tomboMatchScores.get(it.id);
                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectedAjusteRow) onOpenLinkTombo?.(selectedAjusteRow.item, selectedAjusteRow.found, it.id);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && selectedAjusteRow) {
                        onOpenLinkTombo?.(selectedAjusteRow.item, selectedAjusteRow.found, it.id);
                      }
                    }}
                    style={{
                      border: match?.score >= 40 ? "1.5px solid #86efac" : "1px solid #ffedd5",
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: match?.score >= 40 ? "#f0fdf4" : "#fff7ed",
                      cursor: selectedAjusteRow ? "pointer" : "default",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1, minWidth: 0 }}>{it.descricao || it.especie || "—"}</p>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {match?.score >= 15 && <Badge label={`${match.score}%`} c={{ bg: "#dcfce7", tx: "#15803d" }} />}
                        <Badge label={tipo} c={tipoC} />
                      </div>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Nº {getItemCode(it)}</p>
                    {it.marca ? (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Marca: {it.marca}</p>
                    ) : null}
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9a3412", fontWeight: 600 }}>
                      {formatNfLabel(it)} · Data NF: {it.dataNF || "—"}
                    </p>
                    {match?.reasons?.length > 0 && isPro && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "#15803d", fontWeight: 600 }}>Match: {match.reasons.join(", ")}</p>
                    )}
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8", overflowWrap: "anywhere" }}>{buildOrigemLine(it)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { TIPO_ENTRADA_BADGE, getItemCode, getDisplayDesc, formatNfLabel, buildOrigemLine };
