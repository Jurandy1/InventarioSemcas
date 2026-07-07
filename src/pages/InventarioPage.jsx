import React, { useEffect, useMemo, useState } from "react";
import { getCategoryGroup } from "../constants/categories.js";
import { SmartImg } from "../components/SmartImg.jsx";
import { TInput } from "../components/FormFields.jsx";
import { Badge } from "../components/Badge.jsx";
import { EC, SC } from "../constants/inventory.js";
import { canDeleteLocal, countFoundInLocal } from "../utils/inventorySession.js";
import { sortByDataNF, sortLocaisByNewestNf } from "../utils/itemHelpers.js";
import { isItemInventariado } from "../utils/patrimonioId.js";
import { getTeamMemberEditingItem } from "../utils/inventoryPresence.js";
import { isAjustePendente, isSemTomboItem, SEM_TOMBO_BADGE, showFotoManualBadge } from "../utils/semTombo.js";
import { PhotoThumb } from "../components/PhotoThumb.jsx";
import { AjusteWorkbench, buildOrigemLine, getDisplayDesc, getItemCode, TIPO_ENTRADA_BADGE } from "../components/AjusteWorkbench.jsx";
import { getListLimits } from "../utils/mobilePerf.js";

function formatBRL(v) {
  const n = Number(v || 0) || 0;
  try {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return String(n);
  }
}

function buildMetaLine(item) {
  const code = getItemCode(item);
  const data = item?.data || "—";
  const valor = formatBRL(item?.valor || 0);
  return `Nº ${code} · ${data} · R$ ${valor}`;
}

/** Timestamp de quando o registro foi coletado (para ordenar decrescente). */
function parseColetaMs(f) {
  const iso = f?.ultimaAtualizacao;
  if (iso) {
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const [d, m, y] = String(f?.data || "").split("/");
  if (!y) return 0;
  const [hh = 0, mm = 0, ss = 0] = String(f?.hora || "").split(":");
  const t = new Date(+y, +m - 1, +d, +hh, +mm, +ss).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatHoraColeta(f) {
  const hora = String(f?.hora || "").slice(0, 5);
  const data = String(f?.data || "");
  const hoje = new Date().toLocaleDateString("pt-BR");
  if (!hora && !data) return "—";
  if (data === hoje) return hora ? `hoje às ${hora}` : "hoje";
  return `${data}${hora ? ` às ${hora}` : ""}`;
}

export function InventarioPage({
  invSubTab,
  setInvSubTab,
  unidades,
  unidadesAtivas,
  pendingUnids,
  setPendingUnids,
  confirmarAtivas,
  removeAtiva,
  retomarSessaoPausada,
  sessoesPausadas,
  pausedUnitIds,
  foundSet,
  foundMap,
  isMob,
  cd,
  inp,
  bp,
  bs,
  totalFound,
  totalBens,
  progresso,
  filtered,
  search,
  setSearch,
  hideFound,
  setHideFound,
  hideIncorporados,
  setHideIncorporados,
  activeLocalId,
  setActiveLocalId,
  openDetModal,
  onOpenLocalDetail,
  onOpenMulti,
  onOpenManual,
  onOpenSemTombo,
  onOpenFotoVarios,
  onOpenFinalizar,
  onOpenCancelar,
  onOpenConvidarColega,
  onOpenLinkTombo,
  onOpenNextPending,
  campanhaFechada,
  teamOnline,
  myUid = "",
  locais,
  sessionId,
  onQuickAddLocal,
  onDeleteLocal,
  showT,
  onViewImage,
}) {
  const listLimits = useMemo(() => getListLimits(isMob), [isMob]);
  const [viewMode, setViewMode] = useState("padrao");
  const [coletadosLimit, setColetadosLimit] = useState(() => listLimits.coletadosLimit);
  const [localPage, setLocalPage] = useState(1);
  const [perPage, setPerPage] = useState(() => listLimits.perPage);
  const [expandedCats, setExpandedCats] = useState({});
  const [unidadeSearch, setUnidadeSearch] = useState("");
  const [localNomeRapido, setLocalNomeRapido] = useState("");
  const [localSelecionadoId, setLocalSelecionadoId] = useState("");
  const [localAddSearch, setLocalAddSearch] = useState("");
  const [localItemsLimit, setLocalItemsLimit] = useState(() => listLimits.localItemsStep);
  const LOCAL_ITEMS_STEP = listLimits.localItemsStep;

  useEffect(() => {
    setLocalItemsLimit(LOCAL_ITEMS_STEP);
  }, [localSelecionadoId, LOCAL_ITEMS_STEP]);

  useEffect(() => {
    setColetadosLimit(listLimits.coletadosLimit);
    setPerPage(listLimits.perPage);
  }, [listLimits.coletadosLimit, listLimits.perPage]);
  const itemById = useMemo(() => {
    const map = new Map();
    for (const u of unidadesAtivas) for (const i of u.itens) map.set(i.id, { ...i, unidadeId: u.id, unidadeNome: u.nome });
    return map;
  }, [unidadesAtivas]);

  const activeUnitIds = useMemo(() => new Set(unidadesAtivas.map((u) => u.id)), [unidadesAtivas]);

  const foundNoLocal = useMemo(() => {
    const out = [];
    for (const id in foundMap) {
      const f = foundMap[id];
      if (!f) continue;
      if (f.localId !== localSelecionadoId) continue;
      if (activeUnitIds.size && f.unidadeId && !activeUnitIds.has(f.unidadeId)) continue;
      out.push({ id, f });
    }
    out.sort((a, b) => {
      const itA = itemById.get(a.id) || itemById.get(a.f?.patrimonioId || "");
      const itB = itemById.get(b.id) || itemById.get(b.f?.patrimonioId || "");
      return sortByDataNF(itA, itB);
    });
    return out;
  }, [foundMap, localSelecionadoId, activeUnitIds, itemById]);

  const locaisOrdenados = useMemo(
    () => sortLocaisByNewestNf(locais, foundMap, itemById, [...activeUnitIds]),
    [locais, foundMap, itemById, activeUnitIds]
  );

  const pendentes = useMemo(() => {
    if (!localSelecionadoId) return [];
    const out = [];
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        if (hideIncorporados && (i.tipoEntrada || "") === "Incorporado") continue;
        if (!isItemInventariado(i.id, foundSet)) out.push({ ...i, unidadeId: u.id, unidadeNome: u.nome });
      }
    }
    out.sort(sortByDataNF);
    return out;
  }, [localSelecionadoId, unidadesAtivas, foundSet, hideIncorporados]);

  const pendentesFiltrados = useMemo(() => {
    const q = String(localAddSearch || "").trim().toLowerCase();
    if (!q) return pendentes.slice(0, 40);
    const out = [];
    for (const it of pendentes) {
      if (
        (it.especie || "").toLowerCase().includes(q) ||
        (it.descricao || "").toLowerCase().includes(q) ||
        (it.patrimonioLabel || "").toLowerCase().includes(q) ||
        (it.id || "").toLowerCase().includes(q)
      ) {
        out.push(it);
      }
    }
    return out.slice(0, 40);
  }, [pendentes, localAddSearch]);

  // Itens já coletados nesta sessão, do mais recente para o mais antigo —
  // "onde eu parei" durante o inventário.
  const coletadosRecentes = useMemo(() => {
    if (viewMode !== "coletados") return [];
    const out = [];
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        const f = foundMap[i.id];
        if (!f) continue;
        out.push({ item: { ...i, unidadeId: u.id, unidadeNome: u.nome }, f, ms: parseColetaMs(f) });
      }
    }
    out.sort((a, b) => b.ms - a.ms);
    return out;
  }, [viewMode, unidadesAtivas, foundMap]);

  const groupedCategories = useMemo(() => {
    if (viewMode !== "categorias") return [];
    const groups = {};
    for (const item of filtered) {
      const cat = getCategoryGroup(item.especie);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return Object.entries(groups).map(([cat, items]) => ({ cat, items })).sort((a, b) => a.cat.localeCompare(b.cat));
  }, [viewMode, filtered]);

  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  const ajusteCount = useMemo(() => {
    let n = 0;
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        const f = foundMap[i.id];
        if (f && isAjustePendente(i, f)) n++;
      }
    }
    return n;
  }, [unidadesAtivas, foundMap]);

  const subTabs = [
    { id: "inventariar", l: "Inventariar" },
    ...(unidadesAtivas.length > 0 ? [{ id: "andamento", l: "Em Andamento", n: unidadesAtivas.length }] : []),
    { id: "locais", l: "Locais" },
    ...(unidadesAtivas.length > 0 ? [{ id: "ajuste", l: "Ajuste", n: ajusteCount || null }] : []),
    { id: "resumo", l: "Resumo" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          ...(isMob
            ? { overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch", paddingBottom: 4, margin: "0 -12px 14px", padding: "0 12px 4px" }
            : { flexWrap: "wrap" }),
        }}
      >
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setInvSubTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: isMob ? "10px 16px" : "8px 16px",
              minHeight: isMob ? 44 : undefined,
              borderRadius: 9,
              border: "none",
              background: invSubTab === t.id ? "#1351B4" : "#f1f5f9",
              color: invSubTab === t.id ? "#fff" : "#374151",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {t.l}
            {t.n != null && (
              <span style={{ background: invSubTab === t.id ? "rgba(255,255,255,.25)" : "#e2e8f0", color: invSubTab === t.id ? "#fff" : "#64748b", borderRadius: 99, fontSize: 10, fontWeight: 800, padding: "1px 6px" }}>
                {t.n}
              </span>
            )}
          </button>
        ))}
      </div>

      {invSubTab === "inventariar" && (
        <div>
          {unidadesAtivas.length > 0 && (
            <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #c7d2fe", background: "#eef2ff", padding: "12px 16px" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1351B4" }}>
                Inventário pausado · {unidadesAtivas.length} unidade{unidadesAtivas.length > 1 ? "s" : ""} selecionada{unidadesAtivas.length > 1 ? "s" : ""}
              </p>
              <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#475569" }}>
                Retome para continuar inventariando, ou cancele para encerrar a sessão.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setInvSubTab("andamento")} style={{ ...bp, fontSize: 12, padding: "8px 12px" }}>
                  Retomar
                </button>
                <button onClick={onOpenCancelar} style={{ ...bs, fontSize: 12, padding: "8px 12px", color: "#dc2626", borderColor: "#fca5a5" }}>
                  Cancelar sessão
                </button>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Selecione uma ou mais unidades para inventariar juntas</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!hideIncorporados}
              onChange={(e) => setHideIncorporados?.(e.target.checked)}
            />
            Ocultar itens Incorporados (padrão ao iniciar)
          </label>

          {pendingUnids.size > 0 && (
            <div style={{ position: "sticky", top: 64, zIndex: 100, background: "#1351B4", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(30,58,138,.35)", flexWrap: "wrap" }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                {pendingUnids.size} unidade{pendingUnids.size > 1 ? "s" : ""} selecionada{pendingUnids.size > 1 ? "s" : ""}
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setPendingUnids(new Set())} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  Limpar
                </button>
                {unidadesAtivas.length > 0 ? (
                  <>
                    <button
                      onClick={() => {
                        const selected = unidades.filter((u) => pendingUnids.has(u.id));
                        confirmarAtivas(selected, { merge: true });
                        setLocalPage(1);
                      }}
                      style={{ background: "#fff", color: "#1351B4", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}
                    >
                      Adicionar ao inventário
                    </button>
                    <button
                      onClick={() => {
                        const selected = unidades.filter((u) => pendingUnids.has(u.id));
                        confirmarAtivas(selected, { novaSessao: true });
                        setLocalPage(1);
                      }}
                      style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}
                    >
                      Novo inventário (pausa o atual)
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      const selected = unidades.filter((u) => pendingUnids.has(u.id));
                      confirmarAtivas(selected);
                      setLocalPage(1);
                    }}
                    style={{ background: "#fff", color: "#1351B4", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}
                  >
                    Iniciar inventário
                  </button>
                )}
              </div>
            </div>
          )}

          {Array.isArray(sessoesPausadas) && sessoesPausadas.length > 0 && (
            <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #fde68a", background: "#fffbeb", padding: "12px 16px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#92400e" }}>
                Inventários pausados ({sessoesPausadas.length})
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {sessoesPausadas.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#78350f" }}>
                        {(s.unitNomes || s.unitIds || []).join(", ") || "Unidades"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#a16207" }}>
                        Pausado em {s.savedAt ? new Date(s.savedAt).toLocaleString("pt-BR") : "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => retomarSessaoPausada?.(s)}
                      style={{ ...bp, fontSize: 12, padding: "8px 12px", background: "#b45309" }}
                    >
                      Retomar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...cd, marginBottom: 12, padding: "12px 16px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#374151" }}>Local Atual (Auto-preenchimento)</p>
            <select
              value={activeLocalId || ""}
              onChange={(e) => setActiveLocalId?.(e.target.value)}
              style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#f8fafc" }}
            >
              <option value="">— Nenhum local fixado —</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>

          <TInput initial={unidadeSearch} onVal={(v) => setUnidadeSearch(v)} placeholder="Buscar unidade..." style={{ ...inp, marginBottom: 12 }} />

          {unidades.length === 0 ? (
            <div style={{ ...cd, textAlign: "center", padding: 40 }}>
              <p style={{ color: "#94a3b8" }}>Nenhuma unidade carregada.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 10 }}>
              {unidades
                .filter((u) => !unidadeSearch || u.nome.toLowerCase().includes(unidadeSearch.toLowerCase()))
                .map((u) => {
                  const inv = u.itens.filter((i) => isItemInventariado(i.id, foundSet)).length;
                  const pct = u.itens.length > 0 ? Math.round((inv / u.itens.length) * 100) : 0;
                  const isActive = unidadesAtivas.some((x) => x.id === u.id);
                  const isArchivedPaused = pausedUnitIds?.has?.(u.id) && !isActive;
                  const selected = pendingUnids.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        if (isActive) return;
                        setPendingUnids((prev) => {
                          const next = new Set(prev);
                          if (next.has(u.id)) next.delete(u.id);
                          else next.add(u.id);
                          return next;
                        });
                      }}
                      style={{ ...cd, border: `2px solid ${isActive ? "#86efac" : isArchivedPaused ? "#fcd34d" : selected ? "#1351B4" : "#e2e8f0"}`, cursor: isActive ? "default" : "pointer", textAlign: "left", position: "relative", overflow: "hidden", background: isActive ? "#f0fdf4" : isArchivedPaused ? "#fffbeb" : selected ? "#eff6ff" : "#fff" }}
                    >
                      <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 6, border: `2px solid ${isActive ? "#16a34a" : isArchivedPaused ? "#d97706" : selected ? "#1351B4" : "#d1d5db"}`, background: isActive ? "#16a34a" : isArchivedPaused ? "#f59e0b" : selected ? "#1351B4" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 900 }}>
                        {isActive ? "OK" : isArchivedPaused ? "P" : selected ? "OK" : ""}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isActive ? "#15803d" : isArchivedPaused ? "#92400e" : selected ? "#1351B4" : "#0f172a", paddingRight: 28 }}>{u.nome}</p>
                      <p style={{ margin: "4px 0 8px", fontSize: 12, color: isActive ? "#16a34a" : isArchivedPaused ? "#b45309" : "#64748b" }}>
                        {isActive ? "Em inventário" : isArchivedPaused ? "Inventário pausado (retome abaixo)" : `${u.itens.length} itens · ${inv} inventariados`}
                      </p>
                      <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0" }}>
                        <div style={{ height: "100%", background: pct === 100 ? "#16a34a" : isActive ? "#1351B4" : "#94a3b8", borderRadius: 2, width: `${pct}%`, transition: "width .3s" }} />
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {invSubTab === "andamento" && unidadesAtivas.length > 0 && (
        <div>
          <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #bfdbfe", background: "#eff6ff", padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1351B4" }}>
                  {unidadesAtivas.length} unidade{unidadesAtivas.length > 1 ? "s" : ""} em inventário
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#3b82f6" }}>
                  {totalFound}/{totalBens} itens · {progresso}%
                </p>
              </div>
              {(() => {
                const act = {
                  fontSize: isMob ? 13 : 11,
                  padding: isMob ? "10px 12px" : "6px 12px",
                  minHeight: isMob ? 44 : undefined,
                  flex: isMob ? "1 1 calc(50% - 6px)" : undefined,
                };
                return (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: isMob ? "100%" : undefined }}>
                    {!campanhaFechada && onOpenNextPending && (
                      <button onClick={onOpenNextPending} style={{ ...bp, ...act, background: "#0f766e" }}>
                        Próximo pendente
                      </button>
                    )}
                    {!campanhaFechada && (
                      <button onClick={onOpenManual} style={{ ...bs, ...act }}>
                        Manual
                      </button>
                    )}
                    {!campanhaFechada && onOpenMulti && (
                      <button onClick={() => onOpenMulti(null)} style={{ ...bs, ...act, borderColor: "#0f766e", color: "#0f766e" }}>
                        + Vários iguais
                      </button>
                    )}
                    {onOpenConvidarColega && (
                      <button onClick={onOpenConvidarColega} style={{ ...bs, ...act, borderColor: "#7c3aed", color: "#7c3aed" }}>
                        Convidar colega
                      </button>
                    )}
                    {totalFound > 0 && (
                      <button onClick={onOpenFinalizar} style={{ ...bp, ...act }}>
                        Finalizar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setInvSubTab("inventariar");
                        showT?.("Inventário pausado");
                      }}
                      style={{ ...bs, ...act }}
                    >
                      Pausar
                    </button>
                    <button onClick={onOpenCancelar} style={{ ...bs, ...act, color: "#dc2626", borderColor: "#fca5a5" }}>
                      Cancelar
                    </button>
                  </div>
                );
              })()}
            </div>

            <div style={{ height: 5, borderRadius: 3, background: "#dbeafe", marginBottom: 10 }}>
              <div style={{ height: "100%", background: progresso === 100 ? "#16a34a" : "#1351B4", borderRadius: 3, width: `${progresso}%`, transition: "width .3s" }} />
            </div>

            {Array.isArray(teamOnline) && teamOnline.length > 0 && (
              <div style={{ marginBottom: 10, padding: "8px 12px", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 9 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#166534" }}>
                  Equipe na mesma unidade agora: {teamOnline.map((t) => t.nome).join(", ")}
                </p>
                {teamOnline.filter((t) => t.itemEmEdicao).map((t) => (
                  <p key={t.uid} style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 600, color: "#92400e" }}>
                    {t.nome} está em: {t.itemDescricao || t.itemEmEdicao}
                    {t.itemEmEdicao ? ` (Nº ${t.itemEmEdicao})` : ""}
                  </p>
                ))}
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#15803d", lineHeight: 1.35 }}>
                  Itens e locais são compartilhados em tempo real. Itens em uso por colegas são pulados em &quot;Próximo pendente&quot;.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {unidadesAtivas.map((u) => {
                const uFound = u.itens.filter((i) => isItemInventariado(i.id, foundSet)).length;
                const uPct = u.itens.length > 0 ? Math.round((uFound / u.itens.length) * 100) : 0;
                const done = uPct === 100;
                return (
                  <div key={u.id} style={{ background: done ? "#dcfce7" : "#fff", border: `1.5px solid ${done ? "#86efac" : "#cbd5e1"}`, borderRadius: 10, padding: "8px 12px", minWidth: 160, flex: "1 1 160px", maxWidth: 280 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: done ? "#15803d" : "#0f172a", lineHeight: 1.3, flex: 1 }}>
                        {done ? "" : ""}
                        {u.nome.replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 48)}
                      </p>
                      {unidadesAtivas.length > 1 && (
                        <button onClick={() => removeAtiva(u.id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: 0 }} title="Remover">
                          ×
                        </button>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 5px", fontSize: 10, color: done ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                      {uFound}/{u.itens.length} · {uPct}%
                    </p>
                    <div style={{ height: 3, borderRadius: 2, background: done ? "#bbf7d0" : "#e2e8f0" }}>
                      <div style={{ height: "100%", background: done ? "#16a34a" : "#1351B4", borderRadius: 2, width: `${uPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...cd, marginBottom: 12, border: "1px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#334155" }}>Locais da unidade</p>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
              Cada unidade cadastra os locais desta sessão. Só aparecem salas criadas agora — locais de outras unidades ou sessões anteriores não são listados.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: locais.length > 0 ? 10 : 0 }}>
              <input
                value={localNomeRapido}
                onChange={(e) => setLocalNomeRapido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && localNomeRapido.trim()) {
                    onQuickAddLocal(localNomeRapido.trim());
                    setLocalNomeRapido("");
                  }
                }}
                placeholder="Nome da sala ou local... (Enter para salvar)"
                style={{ ...inp, flex: 1 }}
              />
              <button
                onClick={() => {
                  const n = localNomeRapido.trim();
                  if (!n) return;
                  onQuickAddLocal(n);
                  setLocalNomeRapido("");
                }}
                style={{ ...bp, padding: "10px 14px", fontSize: 13, flexShrink: 0 }}
              >
                + Adicionar
              </button>
            </div>
            {locais.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {locaisOrdenados.map((l) => {
                  const countLocal = countFoundInLocal(foundMap, l.id, [...activeUnitIds]);
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        if (onOpenLocalDetail) {
                          onOpenLocalDetail(l);
                        } else {
                          setLocalSelecionadoId(l.id);
                          setInvSubTab("locais");
                        }
                      }}
                      style={{ background: "#f1f5f9", color: "#334155", borderRadius: 99, padding: isMob ? "9px 14px" : "4px 10px", fontSize: isMob ? 13 : 11, minHeight: isMob ? 40 : undefined, fontWeight: 700, border: "1px solid #e2e8f0", cursor: "pointer", touchAction: "manipulation" }}
                      title="Abrir local"
                    >
                      {l.nome} {countLocal ? `(${countLocal})` : ""}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Nenhum local criado nesta unidade ainda.</p>
            )}
          </div>

          <TInput
            initial={search}
            onVal={(v) => {
              setSearch(v);
              setLocalPage(1);
            }}
            placeholder="Buscar Nº, espécie, descrição..."
            style={{ ...inp, marginBottom: 8 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!hideFound}
              onChange={(e) => {
                setHideFound?.(e.target.checked);
                setLocalPage(1);
              }}
            />
            Ocultar itens já encontrados ({totalFound})
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!hideIncorporados}
              onChange={(e) => {
                setHideIncorporados?.(e.target.checked);
                setLocalPage(1);
              }}
            />
            Ocultar itens Incorporados
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => setViewMode("padrao")} style={{ ...bp, background: viewMode === "padrao" ? "#0f172a" : "#fff", color: viewMode === "padrao" ? "#fff" : "#0f172a", borderColor: "#0f172a", padding: isMob ? "10px 14px" : "6px 12px", fontSize: 12 }}>Visualização Padrão</button>
            <button onClick={() => setViewMode("categorias")} style={{ ...bp, background: viewMode === "categorias" ? "#0f172a" : "#fff", color: viewMode === "categorias" ? "#fff" : "#0f172a", borderColor: "#0f172a", padding: isMob ? "10px 14px" : "6px 12px", fontSize: 12 }}>Agrupar por Categoria</button>
            <button
              onClick={() => {
                setViewMode("coletados");
                setColetadosLimit(listLimits.coletadosLimit);
              }}
              style={{ ...bp, background: viewMode === "coletados" ? "#0f766e" : "#fff", color: viewMode === "coletados" ? "#fff" : "#0f766e", borderColor: "#0f766e", padding: isMob ? "10px 14px" : "6px 12px", fontSize: 12 }}
            >
              Últimos coletados ({totalFound})
            </button>
          </div>

          {(() => {
            const renderItemCard = (item) => {
              const f = foundMap[item.id];
              const isF = !!f;
              const reservedBy = !isF ? getTeamMemberEditingItem(teamOnline, item.id, myUid) : null;
              const foto = f?.fotoUrls?.[0];
              const displayDesc = getDisplayDesc(item, f);
              const isPermuta = f?.situacao === "Permuta";
              const tipo = item.tipoEntrada || "Próprio";
              const tipoC = TIPO_ENTRADA_BADGE[tipo] || TIPO_ENTRADA_BADGE["Próprio"];
              const handleOpenItem = () => {
                if (reservedBy) {
                  const msg = `${reservedBy.nome} está inventariando este item`;
                  if (!window.confirm(`${msg}. Abrir mesmo assim?`)) {
                    showT?.(msg);
                    return;
                  }
                }
                openDetModal(item);
              };
              return (
                <div
                  key={`${item.unidadeId}_${item.id}`}
                  onClick={handleOpenItem}
                  style={{
                    ...cd,
                    cursor: "pointer",
                    border: `1.5px solid ${reservedBy ? "#fcd34d" : isPermuta ? "#fcd34d" : isF ? "#bbf7d0" : "#e2e8f0"}`,
                    display: "flex",
                    gap: 12,
                  }}
                >
                  {foto ? (
                    <PhotoThumb
                      src={foto}
                      badge={showFotoManualBadge(item, f)}
                      size={56}
                      onImageClick={() => onViewImage?.(foto)}
                    />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: isPermuta ? "#fef3c7" : isF ? "#f0fdf4" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: "#64748b", fontWeight: 800 }}>
                      {isPermuta ? "Permuta" : isF ? "OK" : ""}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{displayDesc}</p>
                    {isPermuta && f?.permutaDesc && (
                      <div style={{ marginTop: 4, padding: "4px 8px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 7 }}>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: ".04em" }}>Permuta</p>
                        <p style={{ margin: "1px 0 0", fontSize: 12, fontWeight: 700, color: "#78350f" }}>
                          {f.permutaDesc}
                          {f.permutaMarca ? ` · ${f.permutaMarca}` : ""}
                        </p>
                      </div>
                    )}
                    <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>
                      Nº {getItemCode(item)} · {item.data} · R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    {unidadesAtivas.length > 1 && (
                      <p style={{ margin: "1px 0 2px", fontSize: 10, fontWeight: 700, color: "#6366f1" }}>
                        {(item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 40)}
                      </p>
                    )}
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94a3b8" }}>
                      {item.fornecedor || "—"}
                      {item.marca ? ` · ${item.marca}` : ""}
                      {item.nf ? ` · NF ${item.nf}` : ""}
                    </p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Badge label={tipo} c={tipoC} />
                      {isF ? (
                        <>
                          <Badge label={f.estado} c={EC[f.estado]} />
                          <Badge label={f.situacao} c={SC[f.situacao]} />
                          {(f.usuario || f.user) && <Badge label={`${f.usuario || f.user}${f.hora ? ` ${f.hora}` : ""}`} c={{ bg: "#e0e7ff", tx: "#3730a3" }} />}
                        </>
                      ) : (
                        <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
                      )}
                      {f?.plaquetaAusente && <Badge label="Sem plaqueta" c={{ bg: "#ffedd5", tx: "#9a3412" }} />}
                      {reservedBy && <Badge label={`Em uso — ${reservedBy.nome}`} c={{ bg: "#fef3c7", tx: "#92400e" }} />}
                      {(item?.isManual || f?.isManual || String(item?.id || "").startsWith("MAN_")) && <Badge label="Inserido Manualmente" c={{ bg: "#fef08a", tx: "#854d0e" }} />}
                      {item?.unidadeId && f?.unidadeId && item.unidadeId !== f.unidadeId && <Badge label="De Outra Unidade" c={{ bg: "#fecaca", tx: "#991b1b" }} />}
                    </div>
                    {(String(item.id || "").startsWith("MAN_") || String(item.id || "").startsWith("ST_")) && onOpenLinkTombo && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLinkTombo(item, f);
                          }}
                          style={{ ...bp, padding: "6px 12px", fontSize: 11, background: "#0f766e", borderColor: "#0f766e" }}
                        >
                          Reconciliar Tombo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            if (viewMode === "coletados") {
              const getLocalNome = (localId) => locais.find((l) => l.id === localId)?.nome || "Sem local";
              if (coletadosRecentes.length === 0) {
                return (
                  <div style={{ ...cd, textAlign: "center", padding: 32 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 700 }}>Nenhum item coletado nesta sessão ainda.</p>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94a3b8" }}>Conforme você registra itens, eles aparecem aqui do mais recente para o mais antigo.</p>
                  </div>
                );
              }
              return (
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>
                    Do mais recente para o mais antigo — toque para reabrir o item.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(340px,1fr))", gap: 8 }}>
                    {coletadosRecentes.slice(0, coletadosLimit).map(({ item, f }, idx) => {
                      const foto = f?.fotoUrls?.[0];
                      const displayDesc = getDisplayDesc(item, f);
                      return (
                        <div
                          key={`${item.unidadeId}_${item.id}`}
                          onClick={() => openDetModal(item)}
                          style={{ ...cd, cursor: "pointer", border: `1.5px solid ${idx === 0 ? "#5eead4" : "#bbf7d0"}`, background: idx === 0 ? "#f0fdfa" : "#fff", display: "flex", gap: 12, alignItems: "flex-start", padding: 12 }}
                        >
                          {foto ? (
                            <PhotoThumb
                              src={foto}
                              badge={showFotoManualBadge(item, f)}
                              size={64}
                              onImageClick={() => onViewImage?.(foto)}
                            />
                          ) : (
                            <div style={{ width: 64, height: 64, borderRadius: 8, background: "#f1f5f9", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8", fontWeight: 700, flexShrink: 0, textAlign: "center", lineHeight: 1.3 }}>
                              Sem<br />foto
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f766e" }}>
                              Coletado {formatHoraColeta(f)}
                              {idx === 0 ? " · último" : ""}
                            </p>
                            <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 700 }}>{displayDesc}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                              Nº {getItemCode(item)} · {getLocalNome(f?.localId)}
                            </p>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                              <Badge label={f.estado || "—"} c={EC[f.estado]} />
                              <Badge label={f.situacao || "—"} c={SC[f.situacao]} />
                              {f?.plaquetaAusente && <Badge label="Sem plaqueta" c={{ bg: "#ffedd5", tx: "#9a3412" }} />}
                              {(f.usuario || f.user) && <Badge label={f.usuario || f.user} c={{ bg: "#e0e7ff", tx: "#3730a3" }} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {coletadosRecentes.length > coletadosLimit && (
                    <button
                      type="button"
                      onClick={() => setColetadosLimit((n) => n + listLimits.coletadosStep)}
                      style={{ ...bs, width: "100%", marginTop: 10, minHeight: 44 }}
                    >
                      Carregar mais ({coletadosRecentes.length - coletadosLimit} restantes)
                    </button>
                  )}
                </div>
              );
            }

            if (viewMode === "categorias") {
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {groupedCategories.map(({ cat, items }) => {
                    const isExp = expandedCats[cat];
                    return (
                      <div key={cat} style={{ ...cd, padding: 0, overflow: "hidden" }}>
                        <button onClick={() => toggleCat(cat)} style={{ width: "100%", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "none", cursor: "pointer" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{cat} ({items.length})</span>
                          <span style={{ fontSize: 16, color: "#64748b" }}>{isExp ? "▲" : "▼"}</span>
                        </button>
                        {isExp && (
                          <div style={{ padding: 12, display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(380px,1fr))", gap: 10, borderTop: "1px solid #e2e8f0" }}>
                            {items.map((it) => renderItemCard(it))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
            const safePage = Math.min(localPage, totalPages);
            const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage);

            const buildPageButtons = () => {
              if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
              const pages = new Set([1, 2, totalPages - 1, totalPages, safePage - 1, safePage, safePage + 1].filter(p => p >= 1 && p <= totalPages));
              const sorted = [...pages].sort((a, b) => a - b);
              const result = [];
              for (let i = 0; i < sorted.length; i++) {
                if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
                result.push(sorted[i]);
              }
              return result;
            };

            const btnStyle = (active) => ({
              minWidth: isMob ? 42 : 32,
              height: isMob ? 42 : 32,
              borderRadius: 8,
              border: active ? "2px solid #1351B4" : "1.5px solid #e2e8f0",
              background: active ? "#1351B4" : "#fff",
              color: active ? "#fff" : "#374151",
              fontWeight: active ? 800 : 600,
              fontSize: isMob ? 14 : 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 6px",
              transition: "all .15s",
              touchAction: "manipulation",
            });

            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(380px,1fr))", gap: 10 }}>
                  {pageItems.map((item) => renderItemCard(item))}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
                  <button onClick={() => setLocalPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={{ ...btnStyle(false), opacity: safePage === 1 ? 0.4 : 1 }} title="Página anterior">
                    ‹
                  </button>

                  {buildPageButtons().map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "#94a3b8", fontSize: 13 }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setLocalPage(p)} style={btnStyle(p === safePage)}>
                        {p}
                      </button>
                    )
                  )}

                  <button onClick={() => setLocalPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ ...btnStyle(false), opacity: safePage === totalPages ? 0.4 : 1 }} title="Próxima página">
                    ›
                  </button>

                  <select
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setLocalPage(1); }}
                    style={{
                      marginLeft: 12,
                      height: isMob ? 42 : 32,
                      borderRadius: 8,
                      border: "1.5px solid #e2e8f0",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      padding: "0 8px",
                      cursor: "pointer",
                    }}
                  >
                    {[12, 24, 48, 96].map((n) => (
                      <option key={n} value={n}>{n} por página</option>
                    ))}
                  </select>

                  <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>
                    Pág {safePage} de {totalPages} ({filtered.length} itens)
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {invSubTab === "locais" && unidadesAtivas.length === 0 && (
        <div style={{ ...cd, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Inicie um inventário para criar e gerenciar locais.</p>
        </div>
      )}

      {invSubTab === "ajuste" && unidadesAtivas.length > 0 && (
        <AjusteWorkbench
          unidadesAtivas={unidadesAtivas}
          foundSet={foundSet}
          foundMap={foundMap}
          isMob={isMob}
          cd={cd}
          inp={inp}
          bp={bp}
          bs={bs}
          onOpenSemTombo={onOpenSemTombo}
          onOpenFotoVarios={onOpenFotoVarios}
          onOpenLinkTombo={onOpenLinkTombo}
          onViewImage={onViewImage}
        />
      )}

      {invSubTab === "locais" && unidadesAtivas.length > 0 && (
        <div>
          {localSelecionadoId ? (
            (() => {
              const l = locais.find((x) => x.id === localSelecionadoId);
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        setLocalSelecionadoId("");
                        setLocalAddSearch("");
                      }}
                      style={{ ...bs, padding: "8px 12px", fontSize: 12 }}
                    >
                      ← Voltar
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{l?.nome || "Local"}</p>
                      {l?.desc && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{l.desc}</p>}
                    </div>
                    <button
                      onClick={() => onOpenSemTombo?.(localSelecionadoId)}
                      style={{ ...bp, padding: "8px 12px", fontSize: 12 }}
                    >
                      Sem tombo
                    </button>
                    <button
                      onClick={() => onOpenManual?.(localSelecionadoId)}
                      style={{ ...bs, padding: "8px 12px", fontSize: 12 }}
                    >
                      Manual
                    </button>
                  </div>

                  <div style={{ ...cd, marginBottom: 12 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 900, color: "#1351B4" }}>Adicionar item neste local</p>
                    <TInput initial={localAddSearch} onVal={(v) => setLocalAddSearch(v)} placeholder="Buscar pendentes por número/descrição..." style={{ ...inp, marginBottom: 10 }} />
                    {pendentesFiltrados.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Nenhum item pendente encontrado.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(320px,1fr))", gap: 8 }}>
                        {pendentesFiltrados.map((it) => (
                          <div key={it.id} style={{ ...cd, border: "1.5px solid #e2e8f0", padding: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{it.descricao || it.especie || "—"}</p>
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{buildMetaLine(it)}</p>
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8", overflowWrap: "anywhere" }}>{buildOrigemLine(it)}</p>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
                                <Badge label="Sem fotos" c={{ bg: "#f1f5f9", tx: "#475569" }} />
                              </div>
                            </div>
                            <button onClick={() => openDetModal(it, localSelecionadoId)} style={{ ...bp, padding: "8px 10px", fontSize: 12 }}>
                              + Adicionar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ ...cd }}>
                    <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 900, color: "#16a34a" }}>Itens já alocados aqui ({foundNoLocal.length})</p>
                    {foundNoLocal.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Nenhum item registrado neste local ainda.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(320px,1fr))", gap: 8 }}>
                        {foundNoLocal.slice(0, localItemsLimit).map(({ id, f }) => {
                          const it = itemById.get(id) || itemById.get(f.patrimonioId || "");
                          const label = it ? getDisplayDesc(it, f) : f?.descricaoEdit || f?.obs || "—";
                          const metaLine = it ? buildMetaLine(it) : `Nº ${id}`;
                          const origemLine = it ? buildOrigemLine(it) : "—";
                          const fotoCount = Array.isArray(f?.fotoUrls) ? f.fotoUrls.length : 0;
                          const semTombo = isSemTomboItem(it, f);
                          return (
                            <div key={id} style={{ ...cd, border: `1.5px solid ${semTombo ? "#fcd34d" : "#bbf7d0"}`, padding: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{label}</p>
                                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{metaLine}</p>
                                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8", overflowWrap: "anywhere" }}>{origemLine}</p>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                                  {semTombo && <Badge label={SEM_TOMBO_BADGE.label} c={SEM_TOMBO_BADGE} />}
                                  <Badge label={f.estado || "—"} c={EC[f.estado] || { bg: "#f1f5f9", tx: "#334155" }} />
                                  <Badge label={f.situacao || "—"} c={SC[f.situacao] || { bg: "#f1f5f9", tx: "#334155" }} />
                                  <Badge
                                    label={fotoCount > 0 ? `${fotoCount} foto(s)` : "Sem fotos"}
                                    c={fotoCount > 0 ? { bg: "#eff6ff", tx: "#1d4ed8" } : { bg: "#f1f5f9", tx: "#475569" }}
                                  />
                                </div>
                              </div>
                              {fotoCount > 0 && f?.fotoUrls?.[0] ? (
                                <PhotoThumb
                                  src={f.fotoUrls[0]}
                                  badge={showFotoManualBadge(it, f)}
                                  size={48}
                                  onImageClick={() => onViewImage?.(f.fotoUrls[0])}
                                />
                              ) : null}
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                              {semTombo && onOpenLinkTombo ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenLinkTombo(it || { id, descricao: label }, f);
                                  }}
                                  style={{ ...bp, padding: "8px 10px", fontSize: 11 }}
                                >
                                  Vincular tombo
                                </button>
                              ) : null}
                              {it ? (
                                <button onClick={() => openDetModal(it)} style={{ ...bs, padding: "8px 10px", fontSize: 12 }}>
                                  Abrir
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                              )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {foundNoLocal.length > localItemsLimit && (
                      <button
                        type="button"
                        onClick={() => setLocalItemsLimit((n) => n + LOCAL_ITEMS_STEP)}
                        style={{ ...bs, width: "100%", marginTop: 10, minHeight: 44 }}
                      >
                        Carregar mais ({foundNoLocal.length - localItemsLimit} restantes)
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div>
              <div style={{ ...cd, marginBottom: 12 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#334155" }}>Locais da unidade</p>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b" }}>
                  {sessionId
                    ? "Locais desta sessão, só desta unidade. A equipe na mesma unidade vê os mesmos locais criados aqui."
                    : "Inicie um inventário para criar locais."}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={localNomeRapido}
                    onChange={(e) => setLocalNomeRapido(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && localNomeRapido.trim()) {
                        onQuickAddLocal(localNomeRapido.trim());
                        setLocalNomeRapido("");
                      }
                    }}
                    placeholder="Nome da sala ou local... (Enter para salvar)"
                    style={{ ...inp, flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const n = localNomeRapido.trim();
                      if (!n) return;
                      onQuickAddLocal(n);
                      setLocalNomeRapido("");
                    }}
                    style={{ ...bp, padding: "10px 14px", fontSize: 13, flexShrink: 0 }}
                  >
                    + Adicionar
                  </button>
                </div>
              </div>

              {locais.length === 0 ? (
                <div style={{ ...cd, textAlign: "center", padding: 32 }}>
                  <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>Nenhum local nesta unidade ainda.</p>
                  <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 12 }}>Use o campo acima para criar a primeira sala.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {locaisOrdenados.map((l) => {
                    const c = countFoundInLocal(foundMap, l.id, [...activeUnitIds]);
                    return (
                      <div key={l.id} style={{ ...cd, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <button
                          onClick={() => setLocalSelecionadoId(l.id)}
                          style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, flex: 1, minWidth: 0 }}
                        >
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{l.nome}</p>
                          {l.desc && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>{l.desc}</p>}
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b", fontWeight: 700 }}>{c} item(s)</p>
                        </button>
                        {canDeleteLocal(l, sessionId) && (
                          <button
                            onClick={() => {
                              if (c > 0) {
                                showT?.("Remova itens antes");
                                return;
                              }
                              onDeleteLocal?.(l);
                            }}
                            style={{ ...bs, padding: "8px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {invSubTab === "resumo" && (
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Resumo dos itens encontrados, agrupados por local. Mostrando apenas os itens já escaneados nesta sessão.
          </p>
          {locais.map((local) => {
            const itensDoLocal = [];
            unidadesAtivas.forEach((u) => {
              u.itens.forEach((i) => {
                const f = foundMap[i.id];
                if (f && f.localId === local.id) {
                  itensDoLocal.push({ item: i, found: f });
                }
              });
            });
            if (itensDoLocal.length === 0) return null;
            return (
              <div key={local.id} style={{ ...cd, padding: "16px", border: "1.5px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                  {local.nome} <span style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>({itensDoLocal.length})</span>
                </h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {itensDoLocal.map(({ item, found }) => (
                    <div key={item.id} style={{ display: "flex", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                      <div style={{ flexShrink: 0 }}>
                        <SmartImg
                          src={found.fotoUrls?.[0]}
                          size={60}
                          imgStyle={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                          {getDisplayDesc(item, found)}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                          NF: {item.nf || "—"} · Fornecedor: {item.fornecedor || "—"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                          Coletado: {found.data || "—"} {found.hora || ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!locais.some((local) => {
            let hasItem = false;
            unidadesAtivas.forEach((u) => {
              u.itens.forEach((i) => {
                const f = foundMap[i.id];
                if (f && f.localId === local.id) hasItem = true;
              });
            });
            return hasItem;
          }) && (
            <div style={{ ...cd, textAlign: "center", padding: 40, color: "#64748b" }}>
              Nenhum item inventariado encontrado nos locais atuais.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

