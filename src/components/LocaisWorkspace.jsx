import React, { useMemo, useState } from "react";
import { Badge } from "./Badge.jsx";
import { TInput } from "./FormFields.jsx";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { buildOrigemLine, getDisplayDesc, getItemCode } from "./AjusteWorkbench.jsx";
import { EC, SC } from "../constants/inventory.js";
import { canDeleteLocal, countFoundInLocal } from "../utils/inventorySession.js";
import { sortByDataNF, sortLocaisByNewestNf } from "../utils/itemHelpers.js";
import { isItemInventariado } from "../utils/patrimonioId.js";
import { isSemTomboItem, SEM_TOMBO_BADGE, showFotoManualBadge } from "../utils/semTombo.js";

function formatBRL(v) {
  const n = Number(v || 0) || 0;
  try {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return String(n);
  }
}

function buildMetaLine(item) {
  return `Nº ${getItemCode(item)} · ${item?.data || "—"} · R$ ${formatBRL(item?.valor || 0)}`;
}

/** Explorar locais: escolher sala, ver itens alocados e adicionar pendentes. */
export function LocaisWorkspace({
  unidadesAtivas = [],
  foundSet,
  foundMap,
  locais = [],
  sessionId,
  isMob,
  cd,
  inp,
  bp,
  bs,
  openDetModal,
  onOpenSemTombo,
  onOpenManual,
  onOpenLinkTombo,
  onQuickAddLocal,
  onDeleteLocal,
  onViewImage,
  showT,
  readOnly = false,
}) {
  const [localSelecionadoId, setLocalSelecionadoId] = useState("");
  const [localNomeRapido, setLocalNomeRapido] = useState("");
  const [localAddSearch, setLocalAddSearch] = useState("");

  const activeUnitIds = useMemo(() => new Set(unidadesAtivas.map((u) => u.id)), [unidadesAtivas]);

  const itemById = useMemo(() => {
    const map = new Map();
    for (const u of unidadesAtivas) for (const i of u.itens) map.set(i.id, { ...i, unidadeId: u.id, unidadeNome: u.nome });
    return map;
  }, [unidadesAtivas]);

  const foundNoLocal = useMemo(() => {
    const out = [];
    for (const id in foundMap) {
      const f = foundMap[id];
      if (!f || f.localId !== localSelecionadoId) continue;
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
    const out = [];
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        if (!isItemInventariado(i.id, foundSet)) out.push({ ...i, unidadeId: u.id, unidadeNome: u.nome });
      }
    }
    out.sort(sortByDataNF);
    out.sort(sortByDataNF);
    return out;
  }, [unidadesAtivas, foundSet]);

  const pendentesFiltrados = useMemo(() => {
    const q = String(localAddSearch || "").trim().toLowerCase();
    if (!q) return pendentes.slice(0, 40);
    const out = [];
    for (const it of pendentes) {
      if (
        String(it.id || "").toLowerCase().includes(q) ||
        String(it.patrimonioLabel || "").toLowerCase().includes(q) ||
        String(it.descricao || "").toLowerCase().includes(q) ||
        String(it.especie || "").toLowerCase().includes(q) ||
        String(it.fornecedor || "").toLowerCase().includes(q) ||
        String(it.marca || "").toLowerCase().includes(q) ||
        String(it.nf || "").toLowerCase().includes(q)
      ) {
        out.push(it);
        if (out.length >= 40) break;
      }
    }
    out.sort(sortByDataNF);
    return out;
  }, [pendentes, localAddSearch]);

  if (localSelecionadoId) {
    const l = locais.find((x) => x.id === localSelecionadoId);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setLocalSelecionadoId("");
              setLocalAddSearch("");
            }}
            style={{ ...bs, padding: "8px 12px", fontSize: 12 }}
          >
            ← Voltar aos locais
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{l?.nome || "Local"}</p>
            {l?.desc && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{l.desc}</p>}
          </div>
          {!readOnly && onOpenSemTombo && (
            <button type="button" onClick={() => onOpenSemTombo(localSelecionadoId)} style={{ ...bp, padding: "8px 12px", fontSize: 12 }}>
              Sem tombo
            </button>
          )}
          {!readOnly && onOpenManual && (
            <button type="button" onClick={() => onOpenManual(localSelecionadoId)} style={{ ...bs, padding: "8px 12px", fontSize: 12 }}>
              Manual
            </button>
          )}
        </div>

        {!readOnly && (
          <div style={{ ...cd, marginBottom: 12 }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 900, color: "#1351B4" }}>Adicionar item neste local</p>
            <TInput initial={localAddSearch} onVal={setLocalAddSearch} placeholder="Buscar pendentes por número/descrição..." style={{ ...inp, marginBottom: 10 }} />
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
                    </div>
                    <button type="button" onClick={() => openDetModal?.(it, localSelecionadoId)} style={{ ...bp, padding: "8px 10px", fontSize: 12 }}>
                      + Adicionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ ...cd }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 900, color: "#16a34a" }}>Itens neste local ({foundNoLocal.length})</p>
          {foundNoLocal.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Nenhum item registrado neste local ainda.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(320px,1fr))", gap: 8 }}>
              {foundNoLocal.map(({ id, f }) => {
                const it = itemById.get(id) || itemById.get(f.patrimonioId || "");
                const label = it ? getDisplayDesc(it, f) : f?.descricaoEdit || f?.obs || "—";
                const metaLine = it ? buildMetaLine(it) : `Nº ${id}`;
                const semTombo = isSemTomboItem(it, f);
                const fotoCount = Array.isArray(f?.fotoUrls) ? f.fotoUrls.length : 0;
                return (
                  <div key={id} style={{ ...cd, border: `1.5px solid ${semTombo ? "#fcd34d" : "#bbf7d0"}`, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
                    {fotoCount > 0 && f?.fotoUrls?.[0] ? (
                      <PhotoThumb src={f.fotoUrls[0]} badge={showFotoManualBadge(it, f)} size={48} onImageClick={() => onViewImage?.(f.fotoUrls[0])} />
                    ) : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{metaLine}</p>
                      {it ? <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{buildOrigemLine(it)}</p> : null}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                        {semTombo && <Badge label={SEM_TOMBO_BADGE.label} c={SEM_TOMBO_BADGE} />}
                        <Badge label={f.estado || "—"} c={EC[f.estado] || { bg: "#f1f5f9", tx: "#334155" }} />
                        <Badge label={f.situacao || "—"} c={SC[f.situacao] || { bg: "#f1f5f9", tx: "#334155" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      {semTombo && onOpenLinkTombo && !readOnly && (
                        <button type="button" onClick={() => onOpenLinkTombo(it || { id, descricao: label }, f)} style={{ ...bp, padding: "8px 10px", fontSize: 11 }}>
                          Vincular
                        </button>
                      )}
                      {(it || f) && (
                        <button type="button" onClick={() => openDetModal?.(it || { id, unidadeId: f.unidadeId, descricao: label })} style={{ ...bs, padding: "8px 10px", fontSize: 12 }}>
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...cd, marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#334155" }}>Locais da unidade</p>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b" }}>
          Locais desta sessão da unidade. Locais de sessões anteriores (já usados em itens) aparecem somente para consulta — não podem ser removidos.
        </p>
        {!readOnly && (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={localNomeRapido}
              onChange={(e) => setLocalNomeRapido(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && localNomeRapido.trim()) {
                  onQuickAddLocal?.(localNomeRapido.trim());
                  setLocalNomeRapido("");
                }
              }}
              placeholder="Nome da sala ou local..."
              style={{ ...inp, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => {
                const n = localNomeRapido.trim();
                if (!n) return;
                onQuickAddLocal?.(n);
                setLocalNomeRapido("");
              }}
              style={{ ...bp, padding: "10px 14px", fontSize: 13, flexShrink: 0 }}
            >
              + Adicionar
            </button>
          </div>
        )}
      </div>

      {locais.length === 0 ? (
        <div style={{ ...cd, textAlign: "center", padding: 32 }}>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Nenhum local nesta unidade ainda.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {locaisOrdenados.map((l) => {
            const c = countFoundInLocal(foundMap, l.id, [...activeUnitIds]);
            return (
              <div key={l.id} style={{ ...cd, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setLocalSelecionadoId(l.id)}
                  style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, flex: 1, minWidth: 0 }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{l.nome}</p>
                  {l.desc && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>{l.desc}</p>}
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b", fontWeight: 700 }}>{c} item(s)</p>
                </button>
                {!readOnly && onDeleteLocal && canDeleteLocal(l, sessionId, [...activeUnitIds]) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (c > 0) {
                        showT?.("Remova os itens do local antes");
                        return;
                      }
                      onDeleteLocal(l);
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
  );
}
