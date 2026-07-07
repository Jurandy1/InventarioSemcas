import React, { useMemo, useState } from "react";
import { SmartImg } from "../components/SmartImg.jsx";
import { TInput } from "../components/FormFields.jsx";
import {
  clusterSimilarManualItems,
  describeNomeAtributos,
  filterManualItems,
  getItemFotos,
  getItemLabel,
  getItemMarca,
  limparNomeParaExibicao,
} from "../utils/nomeCorrecao.js";
import { getFoundEntry } from "../utils/patrimonioId.js";

const COR_HEX = {
  preto: "#0f172a", branco: "#e2e8f0", azul: "#2563eb", vermelho: "#dc2626",
  verde: "#16a34a", amarelo: "#eab308", cinza: "#6b7280", chumbo: "#4b5563",
  grafite: "#374151", marrom: "#92400e", bege: "#d6c9a8", rosa: "#ec4899",
  roxo: "#7c3aed", lilas: "#c084fc", laranja: "#ea580c", vinho: "#7f1d1d",
  creme: "#f5f0dc", dourado: "#ca8a04", prata: "#9ca3af", prateado: "#9ca3af",
  cromado: "#cbd5e1", turquesa: "#06b6d4", salmao: "#fa8072", fume: "#64748b",
};

/** Marca + atributos detectados (cor, material, medidas, c//s/) como chips. */
function AtributoChips({ nome, marca }) {
  const chips = describeNomeAtributos(nome);
  if (!chips.length && !marca) return null;
  const base = {
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 99,
    padding: "2px 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
      {marca && (
        <span style={{ ...base, background: "#dbeafe", color: "#1d4ed8", textTransform: "uppercase" }}>
          {marca}
        </span>
      )}
      {chips.map((c, i) => {
        if (c.tipo === "cor") {
          return (
            <span key={i} style={{ ...base, background: "#f1f5f9", color: "#334155" }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  background: COR_HEX[c.texto] || "#94a3b8",
                  border: "1px solid rgba(0,0,0,.2)",
                  flexShrink: 0,
                }}
              />
              {c.texto}
            </span>
          );
        }
        return (
          <span key={i} style={{ ...base, background: "#f1f5f9", color: "#64748b" }}>
            {c.texto}
          </span>
        );
      })}
    </div>
  );
}

function ItemPhoto({ foundMap, itemId, onViewImage }) {
  const urls = getItemFotos(itemId, foundMap);
  const src = urls[0];
  if (!src) {
    return (
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 8,
          background: "var(--gov-bg-muted,#f1f5f9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--gov-text-muted)",
          flexShrink: 0,
        }}
      >
        Sem foto
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onViewImage?.(src)}
      style={{ padding: 0, border: "none", background: "none", cursor: "pointer", flexShrink: 0 }}
      title="Ampliar foto"
    >
      <SmartImg
        src={src}
        alt=""
        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--gov-border)" }}
      />
    </button>
  );
}

export function CorrecaoNomesPage({
  todosItens,
  unidades,
  foundMap,
  especies = [],
  inferEspecieFromDesc,
  onAplicarCorrecao,
  onViewImage,
  showT,
  busy,
  isMob,
  inp,
  cd,
  bs,
}) {
  const [modo, setModo] = useState("manual");
  const [unidadeId, setUnidadeId] = useState("todas");
  const [query, setQuery] = useState("");
  const [referenciaId, setReferenciaId] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [nomeEditado, setNomeEditado] = useState("");
  const [grupoChecks, setGrupoChecks] = useState(() => new Map());
  const [grupoNomes, setGrupoNomes] = useState(() => new Map());

  const manuais = useMemo(
    () => filterManualItems(todosItens, foundMap, { unidadeId, query }),
    [todosItens, foundMap, unidadeId, query]
  );

  const grupos = useMemo(
    () => clusterSimilarManualItems(manuais, foundMap, { minScore: 0.68 }),
    [manuais, foundMap]
  );

  const referencia = manuais.find((i) => i.id === referenciaId) || null;
  const nomeReferencia = nomeEditado.trim() || (referencia ? getItemLabel(referencia, foundMap) : "");

  const toggleSel = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const escolherReferencia = (item) => {
    setReferenciaId(item.id);
    // Sugere já o nome limpo (abreviações expandidas, capitalizado)
    setNomeEditado(limparNomeParaExibicao(getItemLabel(item, foundMap)));
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const aplicarManual = async () => {
    if (!nomeReferencia) {
      showT?.("Escolha ou digite o nome padrão");
      return;
    }
    const ids = [...selecionados];
    if (!ids.length) {
      showT?.("Selecione os itens que receberão o novo nome");
      return;
    }
    const especie = inferEspecieFromDesc?.(nomeReferencia, especies) || referencia?.especie || "";
    await onAplicarCorrecao?.({ targetIds: ids, descricao: nomeReferencia, especie });
    setSelecionados(new Set());
    setReferenciaId(null);
    setNomeEditado("");
  };

  const getGrupoNome = (grupo) =>
    String(grupoNomes.get(grupo.key) ?? grupo.sugestaoNome ?? grupo.referenceLabel ?? "").trim();

  const aplicarGrupo = async (grupo, targetIds) => {
    const descricao = getGrupoNome(grupo);
    if (!descricao) {
      showT?.("Digite o nome padrão do grupo");
      return;
    }
    const ids = new Set(targetIds);
    // Se o nome final é diferente do rótulo da referência, renomeia ela também
    if (descricao !== grupo.referenceLabel) ids.add(grupo.referenceId);
    if (!ids.size) {
      showT?.("Nenhum item selecionado no grupo");
      return;
    }
    const especie =
      inferEspecieFromDesc?.(descricao, especies) ||
      grupo.referenceItem?.especie ||
      "";
    await onAplicarCorrecao?.({ targetIds: [...ids], descricao, especie });
    setGrupoChecks((prev) => {
      const next = new Map(prev);
      next.delete(grupo.key);
      return next;
    });
    setGrupoNomes((prev) => {
      const next = new Map(prev);
      next.delete(grupo.key);
      return next;
    });
  };

  const getGrupoTargets = (grupo) => {
    const checked = grupoChecks.get(grupo.key);
    if (checked) return [...checked];
    return grupo.members.filter((m) => !m.isReference).map((m) => m.id);
  };

  const toggleGrupoMember = (grupoKey, memberId, grupo) => {
    setGrupoChecks((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(grupoKey) || grupo.members.filter((m) => !m.isReference).map((m) => m.id));
      if (current.has(memberId)) current.delete(memberId);
      else current.add(memberId);
      next.set(grupoKey, current);
      return next;
    });
  };

  return (
    <div style={{ padding: isMob ? "12px 10px 80px" : "16px 20px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: isMob ? 18 : 22, color: "var(--gov-primary)" }}>Correção de nomes</h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--gov-text-muted)", lineHeight: 1.5 }}>
          Padronize descrições de itens inseridos manualmente. Escolha o nome correto (com foto) e aplique aos
          semelhantes — ou use as sugestões automáticas para detectar erros de digitação.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <select
          value={unidadeId}
          onChange={(e) => setUnidadeId(e.target.value)}
          style={{ ...inp, minWidth: isMob ? "100%" : 220 }}
        >
          <option value="todas">Todas as unidades</option>
          {(unidades || []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <TInput
          initial={query}
          onVal={setQuery}
          placeholder="Buscar nome ou ID…"
          style={{ ...inp, flex: 1, minWidth: 160 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`gov-btn ${modo === "manual" ? "gov-btn--primary" : "gov-btn--secondary"}`}
            style={bs}
            onClick={() => setModo("manual")}
          >
            Manual
          </button>
          <button
            type="button"
            className={`gov-btn ${modo === "sugestoes" ? "gov-btn--primary" : "gov-btn--secondary"}`}
            style={bs}
            onClick={() => setModo("sugestoes")}
          >
            Sugestões ({grupos.length})
          </button>
        </div>
      </div>

      {modo === "manual" && (
        <>
          <div className="gov-card" style={{ ...cd, marginBottom: 14, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>1. Nome padrão (referência)</div>
            {referencia ? (
              <div style={{ fontSize: 12, color: "var(--gov-text-muted)", marginBottom: 8 }}>
                Referência: <strong>{getItemLabel(referencia, foundMap)}</strong> — clique em outro item para trocar
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--gov-text-muted)", marginBottom: 8 }}>
                Clique em &quot;Usar como padrão&quot; em um item da lista abaixo
              </div>
            )}
            <TInput
              key={referenciaId || "nome-padrao"}
              initial={nomeEditado}
              onVal={setNomeEditado}
              placeholder="Ex.: Cadeira giratória c/ encosto"
              style={{ ...inp, width: "100%" }}
            />
          </div>

          <div className="gov-card" style={{ ...cd, marginBottom: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>2. Itens manuais ({manuais.length})</div>
                <div style={{ fontSize: 12, color: "var(--gov-text-muted)" }}>
                  Marque os que devem receber o nome padrão
                </div>
              </div>
              <button
                type="button"
                className="gov-btn gov-btn--primary"
                style={bs}
                disabled={busy || !selecionados.size || !nomeReferencia}
                onClick={aplicarManual}
              >
                Aplicar em {selecionados.size} item(ns)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {manuais.length === 0 && (
              <div className="gov-alert" style={{ padding: 16 }}>
                Nenhum item manual encontrado neste filtro.
              </div>
            )}
            {manuais.map((item) => {
              const label = getItemLabel(item, foundMap);
              const marca = getItemMarca(item, foundMap);
              const found = getFoundEntry(item.id, foundMap);
              const isRef = item.id === referenciaId;
              const checked = selecionados.has(item.id);
              return (
                <div
                  key={item.id}
                  className="gov-card"
                  style={{
                    ...cd,
                    padding: 12,
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    border: isRef ? "2px solid var(--gov-primary)" : checked ? "2px solid #f59e0b" : cd.border,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isRef}
                    onChange={() => toggleSel(item.id)}
                    style={{ marginTop: 28, width: 18, height: 18 }}
                    title="Aplicar nome padrão neste item"
                  />
                  <ItemPhoto foundMap={foundMap} itemId={item.id} onViewImage={onViewImage} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>{label}</div>
                    <AtributoChips nome={label} marca={marca} />
                    <div style={{ fontSize: 12, color: "var(--gov-text-muted)", marginTop: 4 }}>
                      {item.especie || "—"} · {item.unidadeNome || item.unidadeId} · {item.id}
                    </div>
                    {found?.descricaoEdit && found.descricaoEdit !== item.descricao && (
                      <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                        Catálogo: {item.descricao || "—"}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`gov-btn ${isRef ? "gov-btn--primary" : "gov-btn--secondary"}`}
                    style={{ ...bs, whiteSpace: "nowrap" }}
                    onClick={() => escolherReferencia(item)}
                  >
                    {isRef ? "Padrão ✓" : "Usar como padrão"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modo === "sugestoes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {grupos.length === 0 && (
            <div className="gov-alert" style={{ padding: 16 }}>
              Nenhum grupo de nomes parecidos detectado. Tente outra unidade ou use o modo manual.
            </div>
          )}
          {grupos.map((grupo) => {
            const targets = getGrupoTargets(grupo);
            const nomeFinal = getGrupoNome(grupo);
            const totalAplicar = targets.length + (nomeFinal && nomeFinal !== grupo.referenceLabel ? 1 : 0);
            return (
              <div key={grupo.key} className="gov-card" style={{ ...cd, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gov-primary)", textTransform: "uppercase" }}>
                      Sugestão automática · {grupo.members.length} itens
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{grupo.referenceLabel}</div>
                    <AtributoChips
                      nome={grupo.referenceLabel}
                      marca={grupo.members.find((m) => m.isReference)?.marca || ""}
                    />
                  </div>
                  <button
                    type="button"
                    className="gov-btn gov-btn--primary"
                    style={bs}
                    disabled={busy || !totalAplicar || !nomeFinal}
                    onClick={() => aplicarGrupo(grupo, targets)}
                  >
                    Padronizar {totalAplicar} item(ns)
                  </button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 4 }}>
                    ✨ Nome padronizado sugerido — edite se quiser
                  </div>
                  <TInput
                    key={`nome-${grupo.key}`}
                    initial={grupoNomes.get(grupo.key) ?? grupo.sugestaoNome ?? grupo.referenceLabel}
                    onVal={(v) =>
                      setGrupoNomes((prev) => {
                        const next = new Map(prev);
                        next.set(grupo.key, v);
                        return next;
                      })
                    }
                    style={{ ...inp, width: "100%" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grupo.members.map((m) => {
                    const isRef = m.isReference;
                    const checked = isRef || (grupoChecks.get(grupo.key) ? grupoChecks.get(grupo.key).has(m.id) : !isRef);
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          padding: 8,
                          borderRadius: 8,
                          background: isRef ? "rgba(19,81,180,0.08)" : "var(--gov-bg-muted,#f8fafc)",
                        }}
                      >
                        {!isRef && (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGrupoMember(grupo.key, m.id, grupo)}
                            style={{ width: 16, height: 16 }}
                          />
                        )}
                        {isRef && <span style={{ width: 16, textAlign: "center", fontSize: 12 }}>★</span>}
                        <ItemPhoto foundMap={foundMap} itemId={m.id} onViewImage={onViewImage} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: isRef ? 700 : 500, wordBreak: "break-word" }}>{m.label}</div>
                          <AtributoChips nome={m.label} marca={m.marca || getItemMarca(m.item, foundMap)} />
                          <div style={{ fontSize: 11, color: "var(--gov-text-muted)", marginTop: 3 }}>
                            {m.item?.unidadeNome || m.item?.unidadeId || ""}
                            {!isRef && <> · Similaridade: {Math.round((m.score || 0) * 100)}%</>}
                          </div>
                        </div>
                        {isRef && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gov-primary)" }}>PADRÃO</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
