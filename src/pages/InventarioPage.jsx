import React, { useState } from "react";
import { TInput } from "../components/FormFields.jsx";
import { Badge } from "../components/Badge.jsx";
import { EC, SC } from "../constants/inventory.js";
import { getDisplayPhotoUrl } from "../services/storage.js";

function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}

function SmartImg({ src, alt = "", style, ...rest }) {
  const [resolved, setResolved] = React.useState(src || "");
  React.useEffect(() => {
    let alive = true;
    setResolved(src || "");
    (async () => {
      const next = await getDisplayPhotoUrl(src);
      if (!alive) return;
      setResolved(next || src || "");
    })();
    return () => {
      alive = false;
    };
  }, [src]);
  return <img src={resolved} alt={alt} style={style} {...rest} />;
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
  paged,
  page,
  totalPages,
  setPage,
  setSearch,
  openDetModal,
  onOpenManual,
  onOpenFinalizar,
  onOpenCancelar,
  locais,
  onQuickAddLocal,
}) {
  const [unidadeSearch, setUnidadeSearch] = useState("");
  const [localNomeRapido, setLocalNomeRapido] = useState("");

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setInvSubTab("inventariar")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 9,
            border: "none",
            background: invSubTab === "inventariar" ? "#1e3a8a" : "#f1f5f9",
            color: invSubTab === "inventariar" ? "#fff" : "#374151",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          🔍 Inventariar
        </button>
        {unidadesAtivas.length > 0 && (
          <button
            onClick={() => setInvSubTab("andamento")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 9,
              border: "none",
              background: invSubTab === "andamento" ? "#1e3a8a" : "#f1f5f9",
              color: invSubTab === "andamento" ? "#fff" : "#374151",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            📋 Em Andamento
            <span style={{ background: invSubTab === "andamento" ? "rgba(255,255,255,.25)" : "#e2e8f0", color: invSubTab === "andamento" ? "#fff" : "#64748b", borderRadius: 99, fontSize: 10, fontWeight: 800, padding: "1px 6px" }}>
              {unidadesAtivas.length}
            </span>
          </button>
        )}
      </div>

      {invSubTab === "inventariar" && (
        <div>
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Selecione uma ou mais unidades para inventariar juntas</p>
          </div>

          {pendingUnids.size > 0 && (
            <div style={{ position: "sticky", top: 64, zIndex: 100, background: "#1e3a8a", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(30,58,138,.35)" }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                📦 {pendingUnids.size} unidade{pendingUnids.size > 1 ? "s" : ""} selecionada{pendingUnids.size > 1 ? "s" : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPendingUnids(new Set())} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  Limpar
                </button>
                <button
                  onClick={() => {
                    const selected = unidades.filter((u) => pendingUnids.has(u.id));
                    confirmarAtivas(selected);
                    setPage(1);
                  }}
                  style={{ background: "#fff", color: "#1e3a8a", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}
                >
                  ✓ Iniciar inventário
                </button>
              </div>
            </div>
          )}

          <TInput initial="" onVal={(v) => setUnidadeSearch(v)} placeholder="🔍 Buscar unidade..." style={{ ...inp, marginBottom: 12 }} />

          {unidades.length === 0 ? (
            <div style={{ ...cd, textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 48 }}>📂</p>
              <p style={{ color: "#94a3b8" }}>Nenhuma unidade carregada.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 10 }}>
              {unidades
                .filter((u) => !unidadeSearch || u.nome.toLowerCase().includes(unidadeSearch.toLowerCase()))
                .map((u) => {
                  const inv = u.itens.filter((i) => foundSet.has(i.id)).length;
                  const pct = u.itens.length > 0 ? Math.round((inv / u.itens.length) * 100) : 0;
                  const isActive = unidadesAtivas.some((x) => x.id === u.id);
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
                      style={{ ...cd, border: `2px solid ${isActive ? "#86efac" : selected ? "#1e3a8a" : "#e2e8f0"}`, cursor: isActive ? "default" : "pointer", textAlign: "left", position: "relative", overflow: "hidden", background: isActive ? "#f0fdf4" : selected ? "#eff6ff" : "#fff" }}
                    >
                      <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 6, border: `2px solid ${isActive ? "#16a34a" : selected ? "#1e3a8a" : "#d1d5db"}`, background: isActive ? "#16a34a" : selected ? "#1e3a8a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 900 }}>
                        {isActive ? "✓" : selected ? "✓" : ""}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isActive ? "#15803d" : selected ? "#1e3a8a" : "#0f172a", paddingRight: 28 }}>{u.nome}</p>
                      <p style={{ margin: "4px 0 8px", fontSize: 12, color: isActive ? "#16a34a" : "#64748b" }}>{isActive ? "✅ Em inventário" : `${u.itens.length} itens · ${inv} inventariados`}</p>
                      <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0" }}>
                        <div style={{ height: "100%", background: pct === 100 ? "#16a34a" : isActive ? "#1e3a8a" : "#94a3b8", borderRadius: 2, width: `${pct}%`, transition: "width .3s" }} />
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
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e3a8a" }}>
                  📋 {unidadesAtivas.length} unidade{unidadesAtivas.length > 1 ? "s" : ""} em inventário
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#3b82f6" }}>
                  {totalFound}/{totalBens} itens · {progresso}%
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={onOpenManual} style={{ ...bp, fontSize: 11, padding: "6px 12px", background: "#10b981" }}>
                  + Manual
                </button>
                {totalFound > 0 && (
                  <button onClick={onOpenFinalizar} style={{ ...bp, fontSize: 11, padding: "6px 12px", background: "#dc2626" }}>
                    ✓ Finalizar
                  </button>
                )}
                <button onClick={onOpenCancelar} style={{ ...bs, fontSize: 11, padding: "6px 12px", color: "#dc2626", borderColor: "#fca5a5" }}>
                  ⚠️ Cancelar
                </button>
              </div>
            </div>

            <div style={{ height: 5, borderRadius: 3, background: "#dbeafe", marginBottom: 10 }}>
              <div style={{ height: "100%", background: progresso === 100 ? "#16a34a" : "#1e3a8a", borderRadius: 3, width: `${progresso}%`, transition: "width .3s" }} />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {unidadesAtivas.map((u) => {
                const uFound = u.itens.filter((i) => foundSet.has(i.id)).length;
                const uPct = u.itens.length > 0 ? Math.round((uFound / u.itens.length) * 100) : 0;
                const done = uPct === 100;
                return (
                  <div key={u.id} style={{ background: done ? "#dcfce7" : "#fff", border: `1.5px solid ${done ? "#86efac" : "#cbd5e1"}`, borderRadius: 10, padding: "8px 12px", minWidth: 160, flex: "1 1 160px", maxWidth: 280 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: done ? "#15803d" : "#0f172a", lineHeight: 1.3, flex: 1 }}>
                        {done ? "✅ " : "📦 "}
                        {u.nome.replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 48)}
                      </p>
                      {unidadesAtivas.length > 1 && (
                        <button onClick={() => removeAtiva(u.id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: 0 }} title="Remover">
                          ✕
                        </button>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 5px", fontSize: 10, color: done ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                      {uFound}/{u.itens.length} · {uPct}%
                    </p>
                    <div style={{ height: 3, borderRadius: 2, background: done ? "#bbf7d0" : "#e2e8f0" }}>
                      <div style={{ height: "100%", background: done ? "#16a34a" : "#1e3a8a", borderRadius: 2, width: `${uPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...cd, marginBottom: 12, border: "1.5px solid #e0e7ff" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: "#4338ca" }}>📍 Locais / Salas desta sessão</p>
            <div style={{ display: "flex", gap: 8, marginBottom: locais.length > 0 ? 10 : 0 }}>
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
            {locais.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {locais.map((l) => (
                  <span key={l.id} style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: 99, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                    📍 {l.nome}
                  </span>
                ))}
              </div>
            )}
          </div>

          <TInput
            initial=""
            onVal={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="🔍 Buscar Nº, espécie, descrição..."
            style={{ ...inp, marginBottom: 8 }}
          />

          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(380px,1fr))", gap: 10 }}>
            {paged.map((item) => {
              const f = foundMap[item.id];
              const isF = !!f;
              const foto = f?.fotoUrls?.[0];
              const displayDesc = getDisplayDesc(item, f);
              const isPermuta = f?.situacao === "Permuta";
              return (
                <div
                  key={`${item.unidadeId}_${item.id}`}
                  onClick={() => openDetModal(item)}
                  style={{ ...cd, cursor: "pointer", border: `1.5px solid ${isPermuta ? "#fcd34d" : isF ? "#bbf7d0" : "#e2e8f0"}`, display: "flex", gap: 12 }}
                >
                  {foto ? (
                    <SmartImg src={foto} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: isPermuta ? "#fef3c7" : isF ? "#f0fdf4" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                      {isPermuta ? "🔄" : isF ? "✅" : "📷"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{displayDesc}</p>
                    {isPermuta && f?.permutaDesc && (
                      <div style={{ marginTop: 4, padding: "4px 8px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 7 }}>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: ".04em" }}>🔄 Real</p>
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
                        🏛️ {(item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 40)}
                      </p>
                    )}
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94a3b8" }}>
                      {item.fornecedor || "—"}
                      {item.marca ? ` · ${item.marca}` : ""}
                      {item.nf ? ` · NF ${item.nf}` : ""}
                    </p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {isF ? (
                        <>
                          <Badge label={f.estado} c={EC[f.estado]} />
                          <Badge label={f.situacao} c={SC[f.situacao]} />
                          {(f.usuario || f.user) && <Badge label={`${f.usuario || f.user}${f.hora ? ` ${f.hora}` : ""}`} c={{ bg: "#e0e7ff", tx: "#3730a3" }} />}
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
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                «
              </button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                ‹
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Pág {page}/{totalPages} · {filtered.length} itens
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                ›
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                »
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

