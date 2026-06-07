import React, { useMemo, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { TInput } from "../components/FormFields.jsx";
import { PhotoThumb } from "../components/PhotoThumb.jsx";
import { AjusteWorkbench, TIPO_ENTRADA_BADGE, getDisplayDesc, getItemCode, buildOrigemLine, formatNfLabel } from "../components/AjusteWorkbench.jsx";
import { LocaisWorkspace } from "../components/LocaisWorkspace.jsx";
import { getTombosDivergentes, TOMBO_DIVERGENTE_BADGE } from "../utils/tomboEstrangeiro.js";
import { isTomboPendente, showFotoManualBadge } from "../utils/semTombo.js";
import { sortByDataNF } from "../utils/itemHelpers.js";
import { EC, SC } from "../constants/inventory.js";
import { isItemInventariado } from "../utils/patrimonioId.js";

const PER_PAGE = 24;

function shortUnitName(nome) {
  return String(nome || "").replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 48);
}

function formatDataFin(v) {
  if (!v) return "—";
  if (String(v).includes("/")) return v;
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}

export function FinalizadosPage({
  finalizacoes = [],
  loading,
  onRefresh,
  onEdit,
  editFin = null,
  editUnits = [],
  onCloseEdit,
  foundSet,
  foundMap,
  locais = [],
  isMob,
  cd,
  inp,
  bp,
  bs,
  openDetModal,
  onOpenSemTombo,
  onOpenFotoVarios,
  onOpenLinkTombo,
  onConfirmTomboDivergente,
  onOpenManual,
  onQuickAddLocal,
  onDeleteLocal,
  onViewImage,
  showT,
  sessionId,
  campanhaFechada,
  logado,
}) {
  const [buscaLista, setBuscaLista] = useState("");
  const [editTab, setEditTab] = useState("itens");
  const [search, setSearch] = useState("");
  const [neSearch, setNeSearch] = useState("");
  const [hideFound, setHideFound] = useState(false);
  const [page, setPage] = useState(1);
  const [nePage, setNePage] = useState(1);

  const listaFiltrada = useMemo(() => {
    const q = buscaLista.trim().toLowerCase();
    if (!q) return finalizacoes;
    return finalizacoes.filter(
      (f) =>
        (f.unidadeNomes || []).some((n) => String(n).toLowerCase().includes(q)) ||
        String(f.coordenadora?.nome || "").toLowerCase().includes(q) ||
        String(f.finalizedAt || "").toLowerCase().includes(q)
    );
  }, [finalizacoes, buscaLista]);

  const allItens = useMemo(
    () => editUnits.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome }))),
    [editUnits]
  );

  const totalBens = allItens.length;
  const totalFound = useMemo(() => allItens.filter((i) => isItemInventariado(i.id, foundSet)).length, [allItens, foundSet]);
  const progresso = totalBens > 0 ? Math.round((totalFound / totalBens) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allItens;
    if (hideFound) list = list.filter((i) => !isItemInventariado(i.id, foundSet));
    if (!q) return [...list].sort(sortByDataNF);
    return list
      .filter(
        (i) =>
          String(i.id || "").toLowerCase().includes(q) ||
          String(i.descricao || "").toLowerCase().includes(q) ||
          String(i.especie || "").toLowerCase().includes(q) ||
          String(i.fornecedor || "").toLowerCase().includes(q) ||
          String(i.marca || "").toLowerCase().includes(q) ||
          String(i.nf || "").toLowerCase().includes(q)
      )
      .sort(sortByDataNF);
  }, [allItens, search, hideFound, foundSet]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const activeUnitIds = useMemo(() => editUnits.map((u) => u.id), [editUnits]);
  const canEdit = !campanhaFechada || logado?.role === "admin";

  const naoEncontrados = useMemo(() => {
    return allItens.filter((i) => isTomboPendente(i, foundSet)).sort(sortByDataNF);
  }, [allItens, foundSet]);

  const naoEncontradosFiltrados = useMemo(() => {
    const q = neSearch.trim().toLowerCase();
    if (!q) return naoEncontrados;
    return naoEncontrados.filter(
      (i) =>
        String(i.id || "").toLowerCase().includes(q) ||
        String(i.descricao || "").toLowerCase().includes(q) ||
        String(i.especie || "").toLowerCase().includes(q) ||
        String(i.marca || "").toLowerCase().includes(q) ||
        String(i.nf || "").toLowerCase().includes(q) ||
        String(i.tipoEntrada || "").toLowerCase().includes(q)
    );
  }, [naoEncontrados, neSearch]);

  const neTotalPages = Math.max(1, Math.ceil(naoEncontradosFiltrados.length / PER_PAGE));
  const nePaged = naoEncontradosFiltrados.slice((nePage - 1) * PER_PAGE, nePage * PER_PAGE);

  const tombosDivergentes = useMemo(
    () => getTombosDivergentes(foundMap, editUnits, activeUnitIds),
    [foundMap, editUnits, activeUnitIds]
  );

  if (editFin && editUnits.length > 0) {
    return (
      <div>
        <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #86efac", background: "#f0fdf4", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <button type="button" onClick={onCloseEdit} style={{ ...bs, fontSize: 11, padding: "4px 10px", marginBottom: 8 }}>
                ← Voltar à lista
              </button>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#14532d" }}>
                {editFin.unidadeNomes?.length === 1 ? shortUnitName(editFin.unidadeNomes[0]) : `${editFin.unidadeNomes?.length || 0} unidades`}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#15803d" }}>
                Finalizado em {formatDataFin(editFin.finalizedAt)}
                {editFin.coordenadora?.nome ? ` · Coord. ${editFin.coordenadora.nome}` : ""}
                {editFin.legacy ? " · registro legado" : ""}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#166534", fontWeight: 600 }}>
                {totalFound}/{totalBens} itens · {progresso}% · {Math.max(0, totalBens - totalFound)} não encontrados
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {onOpenSemTombo && !campanhaFechada && (
                <button onClick={() => onOpenSemTombo()} style={{ ...bp, fontSize: 11, padding: "6px 12px" }}>
                  + Foto sem tombo
                </button>
              )}
            </div>
          </div>
          {campanhaFechada && logado?.role !== "admin" && (
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "#b45309", fontWeight: 600 }}>
              Campanha fechada — você pode consultar. Apenas administrador pode alterar registros.
            </p>
          )}
          {!campanhaFechada && (
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "#166534", lineHeight: 1.45 }}>
              Finalizar não bloqueia correções. Ajuste itens, locais e vínculos de mobiliário aqui com as mesmas ferramentas do inventário ativo.
            </p>
          )}
          <div style={{ height: 5, borderRadius: 3, background: "#bbf7d0", marginTop: 10 }}>
            <div style={{ height: "100%", background: progresso === 100 ? "#16a34a" : "#15803d", borderRadius: 3, width: `${progresso}%` }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            { id: "itens", l: "Itens", n: totalBens },
            { id: "locais", l: "Locais", n: locais.length },
            { id: "naoEncontrados", l: "Não encontrados", n: naoEncontrados.length },
            { id: "divergentes", l: "Tombos divergentes", n: tombosDivergentes.length },
            { id: "ajuste", l: "Ligação mobiliário", n: null },
            { id: "resumo", l: "Resumo", n: null },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setEditTab(t.id)}
              style={{
                ...bs,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                background: editTab === t.id ? "#1351B4" : "#fff",
                color: editTab === t.id ? "#fff" : "#374151",
                borderColor: editTab === t.id ? "#1351B4" : "#e2e8f0",
              }}
            >
              {t.l}
              {t.n != null ? ` (${t.n})` : ""}
            </button>
          ))}
        </div>

        {editTab === "itens" && (
          <div>
            <TInput
              initial={search}
              onVal={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Buscar Nº, espécie, descrição, marca..."
              style={{ ...inp, marginBottom: 8 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={hideFound} onChange={(e) => { setHideFound(e.target.checked); setPage(1); }} />
              Ocultar itens já encontrados ({totalFound})
            </label>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(380px,1fr))", gap: 10 }}>
              {paged.map((item) => {
                const f = foundMap[item.id];
                const isF = !!f;
                const foto = f?.fotoUrls?.[0];
                const displayDesc = getDisplayDesc(item, f);
                const isPermuta = f?.situacao === "Permuta";
                const tipo = item.tipoEntrada || "Próprio";
                const tipoC = TIPO_ENTRADA_BADGE[tipo] || TIPO_ENTRADA_BADGE["Próprio"];
                return (
                  <div
                    key={`${item.unidadeId}_${item.id}`}
                    onClick={() => openDetModal?.(item)}
                    style={{ ...cd, cursor: "pointer", border: `1.5px solid ${isPermuta ? "#fcd34d" : isF ? "#bbf7d0" : "#e2e8f0"}`, display: "flex", gap: 12 }}
                  >
                    {foto ? (
                      <PhotoThumb src={foto} badge={showFotoManualBadge(item, f)} size={56} onImageClick={() => onViewImage?.(foto)} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 8, background: isPermuta ? "#fef3c7" : isF ? "#f0fdf4" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: "#64748b", fontWeight: 800 }}>
                        {isPermuta ? "Permuta" : isF ? "OK" : ""}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{displayDesc}</p>
                      <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>
                        Nº {getItemCode(item)} · {item.data} · R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {editUnits.length > 1 && (
                        <p style={{ margin: "1px 0 2px", fontSize: 10, fontWeight: 700, color: "#6366f1" }}>{shortUnitName(item.unidadeNome)}</p>
                      )}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        <Badge label={tipo} c={tipoC} />
                        {isF ? (
                          <>
                            <Badge label={f.estado} c={EC[f.estado]} />
                            <Badge label={f.situacao} c={SC[f.situacao]} />
                          </>
                        ) : (
                          <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>‹</button>
                <span style={{ fontSize: 12, color: "#64748b" }}>Pág {page}/{totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>›</button>
              </div>
            )}
          </div>
        )}

        {editTab === "ajuste" && (
          <AjusteWorkbench
            unidadesAtivas={editUnits}
            foundSet={foundSet}
            foundMap={foundMap}
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            mode="pro"
            onOpenSemTombo={campanhaFechada && logado?.role !== "admin" ? undefined : onOpenSemTombo}
            onOpenFotoVarios={campanhaFechada && logado?.role !== "admin" ? undefined : onOpenFotoVarios}
            onOpenLinkTombo={onOpenLinkTombo}
            onViewImage={onViewImage}
          />
        )}

        {editTab === "locais" && (
          <LocaisWorkspace
            unidadesAtivas={editUnits}
            foundSet={foundSet}
            foundMap={foundMap}
            locais={locais}
            sessionId={sessionId}
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            openDetModal={openDetModal}
            onOpenSemTombo={canEdit ? onOpenSemTombo : undefined}
            onOpenManual={canEdit ? onOpenManual : undefined}
            onOpenLinkTombo={onOpenLinkTombo}
            onQuickAddLocal={canEdit ? onQuickAddLocal : undefined}
            onDeleteLocal={canEdit ? onDeleteLocal : undefined}
            onViewImage={onViewImage}
            showT={showT}
            readOnly={!canEdit}
          />
        )}

        {editTab === "naoEncontrados" && (
          <div>
            <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #fed7aa", background: "#fff7ed", padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#c2410c" }}>
                Tombos da planilha ainda não encontrados ({naoEncontrados.length})
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9a3412", lineHeight: 1.45 }}>
                Itens que constam no patrimônio da unidade mas não foram inventariados. Se encontrar um deles depois, clique para registrar.
              </p>
            </div>
            <TInput
              initial={neSearch}
              onVal={(v) => {
                setNeSearch(v);
                setNePage(1);
              }}
              placeholder="Buscar tombo, NF, descrição, marca, tipo..."
              style={{ ...inp, marginBottom: 10 }}
            />
            {nePaged.length === 0 ? (
              <div style={{ ...cd, padding: 32, textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                  {naoEncontrados.length === 0 ? "Todos os tombos desta unidade foram inventariados." : "Nenhum resultado na busca."}
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px,1fr))", gap: 8 }}>
                {nePaged.map((it) => {
                  const tipo = it.tipoEntrada || "Próprio";
                  const tipoC = TIPO_ENTRADA_BADGE[tipo] || TIPO_ENTRADA_BADGE["Próprio"];
                  return (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => canEdit && openDetModal?.(it)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && canEdit) openDetModal?.(it);
                      }}
                      style={{ ...cd, border: "1.5px solid #ffedd5", cursor: canEdit ? "pointer" : "default", padding: 12 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, flex: 1 }}>{it.descricao || it.especie || "—"}</p>
                        <Badge label={tipo} c={tipoC} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Nº {getItemCode(it)}</p>
                      {it.marca ? <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Marca: {it.marca}</p> : null}
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9a3412", fontWeight: 600 }}>
                        {formatNfLabel(it)} · Data NF: {it.dataNF || "—"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>{buildOrigemLine(it)}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {neTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
                <button type="button" onClick={() => setNePage((p) => Math.max(1, p - 1))} disabled={nePage === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>‹</button>
                <span style={{ fontSize: 12, color: "#64748b" }}>Pág {nePage}/{neTotalPages}</span>
                <button type="button" onClick={() => setNePage((p) => Math.min(neTotalPages, p + 1))} disabled={nePage === neTotalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>›</button>
              </div>
            )}
          </div>
        )}

        {editTab === "divergentes" && (
          <div>
            <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #fbcfe8", background: "#fdf2f8", padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#9d174d" }}>
                Tombos divergentes ({tombosDivergentes.length})
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#831843", lineHeight: 1.45 }}>
                Número registrado ou etiqueta não consta na planilha desta unidade — possível tombo trocado. Manter o registro ou vincular a um item da planilha.
              </p>
            </div>
            {tombosDivergentes.length === 0 ? (
              <div style={{ ...cd, padding: 32, textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Nenhum tombo divergente pendente.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {tombosDivergentes.map(({ id, f, item, tomboLabel, reasons, semTombo }) => {
                  const foto = f?.fotoUrls?.[0];
                  const label = item ? getDisplayDesc(item, f) : f?.descricaoEdit || f?.obs || "—";
                  return (
                    <div key={id} style={{ ...cd, border: "1.5px solid #fbcfe8", padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {foto ? (
                        <PhotoThumb src={foto} size={56} onImageClick={() => onViewImage?.(foto)} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: "#fce7f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#9d174d" }}>?</div>
                      )}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{label}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                          Tombo/Etiqueta: <strong>{tomboLabel || id}</strong>
                        </p>
                        {reasons.map((r) => (
                          <p key={r} style={{ margin: "4px 0 0", fontSize: 11, color: "#be185d", fontWeight: 600 }}>• {r}</p>
                        ))}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                          <Badge label={TOMBO_DIVERGENTE_BADGE.label} c={TOMBO_DIVERGENTE_BADGE} />
                          {semTombo && <Badge label="Sem tombo" c={{ bg: "#fef3c7", tx: "#92400e" }} />}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        {canEdit && onConfirmTomboDivergente && (
                          <button type="button" onClick={() => onConfirmTomboDivergente(id, f)} style={{ ...bs, padding: "8px 12px", fontSize: 11, borderColor: "#86efac", color: "#15803d" }}>
                            Manter aqui
                          </button>
                        )}
                        {canEdit && onOpenLinkTombo && (
                          <button type="button" onClick={() => onOpenLinkTombo(item || { id, descricao: label, unidadeId: f.unidadeId }, f)} style={{ ...bp, padding: "8px 12px", fontSize: 11 }}>
                            Vincular à planilha
                          </button>
                        )}
                        <button type="button" onClick={() => openDetModal?.(item || { id, unidadeId: f.unidadeId, descricao: label })} style={{ ...bs, padding: "8px 12px", fontSize: 11 }}>
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {editTab === "resumo" && (
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
            <div style={{ ...cd, textAlign: "center", border: "1px solid #bbf7d0", background: "#f0fdf4" }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#15803d" }}>{totalFound}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Encontrados</p>
            </div>
            <div style={{ ...cd, textAlign: "center", border: "1px solid #fed7aa", background: "#fff7ed" }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#c2410c" }}>{Math.max(0, totalBens - totalFound)}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Não encontrados</p>
            </div>
            <div style={{ ...cd, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#1351B4" }}>{progresso}%</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Progresso</p>
            </div>
            {editFin.coordenadora?.nome && (
              <div style={{ ...cd, gridColumn: isMob ? "1" : "1 / -1" }}>
                <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#334155" }}>Coordenadora na finalização</p>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  {editFin.coordenadora.nome} · matr. {editFin.coordenadora.matricula || "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...cd, marginBottom: 12, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Inventários finalizados</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5, maxWidth: 560 }}>
              Finalizar encerra a sessão ativa, mas os dados continuam editáveis aqui. Corrija itens, locais e ligue mobiliário aos tombos com ferramentas avançadas de match.
            </p>
          </div>
          <button type="button" onClick={onRefresh} disabled={loading} style={{ ...bs, fontSize: 12, padding: "8px 14px" }}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      <TInput initial={buscaLista} onVal={setBuscaLista} placeholder="Buscar unidade ou coordenadora..." style={{ ...inp, marginBottom: 12 }} />

      {listaFiltrada.length === 0 ? (
        <div style={{ ...cd, padding: 40, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#64748b" }}>
            {loading ? "Carregando…" : "Nenhum inventário finalizado ainda"}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Ao concluir a finalização na aba Inventário, o registro aparecerá aqui para consulta e ajustes.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {listaFiltrada.map((fin) => {
            const stats = fin.stats || {};
            const pct = stats.progresso ?? (stats.totalBens ? Math.round(((stats.totalFound || 0) / stats.totalBens) * 100) : 0);
            const canEdit = fin.unidadeIds?.length > 0;
            return (
              <div key={fin.id} style={{ ...cd, border: fin.legacy ? "1px dashed #cbd5e1" : "1.5px solid #86efac", background: "#fafafa" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>
                  {fin.unidadeNomes?.length === 1 ? shortUnitName(fin.unidadeNomes[0]) : fin.unidadeNomes?.map(shortUnitName).join(" · ") || "Unidade"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
                  {formatDataFin(fin.finalizedAt)}
                  {fin.coordenadora?.nome ? ` · ${fin.coordenadora.nome}` : ""}
                </p>
                {fin.legacy ? (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                    {stats.totalNE || 0} tombo(s) NE registrados (legado)
                  </p>
                ) : (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#15803d", fontWeight: 600 }}>
                    {stats.totalFound ?? "—"}/{stats.totalBens ?? "—"} · {pct}% · {stats.totalNE ?? 0} NE
                  </p>
                )}
                <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0", margin: "10px 0" }}>
                  <div style={{ height: "100%", background: "#16a34a", borderRadius: 2, width: `${Math.min(100, pct)}%` }} />
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && onEdit?.(fin)}
                  style={{ ...bp, width: "100%", fontSize: 12, padding: "10px", opacity: canEdit ? 1 : 0.5 }}
                  title={canEdit ? "Abrir ferramentas de edição" : "Unidade não identificada no cadastro"}
                >
                  Editar inventário
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
