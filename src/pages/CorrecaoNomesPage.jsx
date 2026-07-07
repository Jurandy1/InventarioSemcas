import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TInput } from "../components/FormFields.jsx";
import { AtributoChips } from "../components/correcao/AtributoChips.jsx";
import { CorrecaoItemPhoto } from "../components/correcao/CorrecaoItemPhoto.jsx";
import { CorrecaoStats } from "../components/correcao/CorrecaoStats.jsx";
import { PadronizacaoLoteCard } from "../components/correcao/PadronizacaoLoteCard.jsx";
import { NomeDiff } from "../components/correcao/NomeDiff.jsx";
import {
  FILTRO_PROBLEMA,
  ESTADO_LISTA,
  agruparItensParaPadronizacao,
  buildCorrecaoDashboard,
  computeNomeQualityScore,
  detectProblemasNome,
  filterInventariadosItems,
  formatarNomePadrao,
  getItemLabel,
  getItemMarca,
  padronizarNome,
  precisaPadronizacao,
} from "../utils/nomeCorrecao.js";
import { getFoundEntry } from "../utils/patrimonioId.js";
import "../styles/correcao-nomes.css";

const PER_PAGE_DESK = 30;
const PER_PAGE_MOB = 15;

function scoreClass(score) {
  if (score >= 75) return "correcao-score";
  if (score >= 50) return "correcao-score correcao-score--mid";
  return "correcao-score correcao-score--low";
}

export function CorrecaoNomesPage({
  todosItens,
  unidades,
  foundMap,
  foundSet,
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
  const [modo, setModo] = useState("revisar");
  const [unidadeId, setUnidadeId] = useState("todas");
  const [query, setQuery] = useState("");
  const [filtroProblema, setFiltroProblema] = useState(FILTRO_PROBLEMA.TODOS);
  const [nomePersonalizado, setNomePersonalizado] = useState("");
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [loteChecks, setLoteChecks] = useState(() => new Map());
  const [loteNomes, setLoteNomes] = useState(() => new Map());
  const [lotesAbertos, setLotesAbertos] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageCorrigidos, setPageCorrigidos] = useState(1);
  const [confirmLote, setConfirmLote] = useState(false);

  const lotes = useMemo(
    () => agruparItensParaPadronizacao(todosItens, foundMap, foundSet, { unidadeId }),
    [todosItens, foundMap, foundSet, unidadeId]
  );

  const stats = useMemo(
    () => buildCorrecaoDashboard(todosItens, foundMap, foundSet, lotes),
    [todosItens, foundMap, foundSet, lotes]
  );

  const itensPendentes = useMemo(
    () =>
      filterInventariadosItems(todosItens, foundMap, foundSet, {
        unidadeId,
        query,
        filtroProblema,
        estadoLista: ESTADO_LISTA.PENDENTES,
      }),
    [todosItens, foundMap, foundSet, unidadeId, query, filtroProblema]
  );

  const itensCorrigidos = useMemo(
    () =>
      filterInventariadosItems(todosItens, foundMap, foundSet, {
        unidadeId,
        query,
        filtroProblema: FILTRO_PROBLEMA.TODOS,
        estadoLista: ESTADO_LISTA.CORRIGIDOS,
      }),
    [todosItens, foundMap, foundSet, unidadeId, query]
  );

  const itensLista = modo === "corrigidos" ? itensCorrigidos : itensPendentes;

  const perPage = isMob ? PER_PAGE_MOB : PER_PAGE_DESK;
  const pageAtiva = modo === "corrigidos" ? pageCorrigidos : page;
  const setPageAtiva = modo === "corrigidos" ? setPageCorrigidos : setPage;
  const totalPages = Math.max(1, Math.ceil(itensLista.length / perPage));
  const pageSafe = Math.min(pageAtiva, totalPages);
  const itensPage = itensLista.slice((pageSafe - 1) * perPage, pageSafe * perPage);

  useEffect(() => {
    setPage(1);
    setPageCorrigidos(1);
  }, [unidadeId, query, filtroProblema, modo]);

  const toggleSel = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selecionarTodosVisiveis = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const item of itensPage) next.add(item.id);
      return next;
    });
  };

  const selecionarTudo = () => {
    setSelecionados(new Set(itensPendentes.map((i) => i.id)));
    if (itensPendentes.length) {
      showT?.(`${itensPendentes.length} item(ns) selecionado(s)`);
    }
  };

  const limparSelecao = () => setSelecionados(new Set());

  const nomeAplicar = formatarNomePadrao(nomePersonalizado.trim());
  const primeiroSel = [...selecionados][0];
  const itemPreview = primeiroSel ? todosItens.find((i) => i.id === primeiroSel) : null;
  const labelPreview = itemPreview ? getItemLabel(itemPreview, foundMap) : "";
  const especieInferida =
    nomeAplicar && inferEspecieFromDesc
      ? inferEspecieFromDesc(nomeAplicar, especies) || itemPreview?.especie || ""
      : "";

  const aplicarNomeDigitado = async () => {
    if (!nomeAplicar) {
      showT?.("Digite o nome padrão no campo ao lado");
      return;
    }
    const ids = [...selecionados];
    if (!ids.length) {
      showT?.("Selecione os itens que receberão o novo nome");
      return;
    }
    await onAplicarCorrecao?.({
      targetIds: ids,
      descricao: nomeAplicar,
      especie: especieInferida,
    });
    setSelecionados(new Set());
    setNomePersonalizado("");
  };

  const aplicarPadronizacaoItens = async (ids) => {
    const correcoes = [];
    for (const id of ids) {
      const item = todosItens.find((i) => i.id === id);
      if (!item) continue;
      const original = getItemLabel(item, foundMap);
      const descricao = padronizarNome(original);
      if (!descricao || normalize(original) === normalize(descricao)) continue;
      correcoes.push({
        targetIds: [id],
        descricao,
        especie: inferEspecieFromDesc?.(descricao, especies) || item.especie || "",
      });
    }
    if (!correcoes.length) {
      showT?.("Nenhum item precisa de padronização");
      return;
    }
    await onAplicarCorrecao?.(correcoes.length === 1 ? correcoes[0] : correcoes);
    setSelecionados(new Set());
  };

  const aplicarSelecionados = () => aplicarPadronizacaoItens([...selecionados]);

  const getLoteNome = (lote) =>
    String(loteNomes.get(lote.key) ?? lote.nomePadronizado ?? "").trim();

  const getLoteTargets = (lote) => {
    const checked = loteChecks.get(lote.key);
    if (checked) return [...checked];
    return lote.members.map((m) => m.id);
  };

  const toggleLoteMember = (loteKey, memberId, lote) => {
    setLoteChecks((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(loteKey) || lote.members.map((m) => m.id));
      if (current.has(memberId)) current.delete(memberId);
      else current.add(memberId);
      next.set(loteKey, current);
      return next;
    });
  };

  const aplicarLote = async (lote, targetIds) => {
    const descricao = formatarNomePadrao(getLoteNome(lote));
    if (!descricao) {
      showT?.("Digite o nome padronizado");
      return;
    }
    if (!targetIds.length) {
      showT?.("Nenhum item selecionado");
      return;
    }
    await onAplicarCorrecao?.({
      targetIds,
      descricao,
      especie: inferEspecieFromDesc?.(descricao, especies) || lote.members[0]?.item?.especie || "",
    });
    setLoteChecks((prev) => {
      const next = new Map(prev);
      next.delete(lote.key);
      return next;
    });
    setLoteNomes((prev) => {
      const next = new Map(prev);
      next.delete(lote.key);
      return next;
    });
  };

  const prepararLoteTotal = useCallback(() => {
    const correcoes = [];
    for (const lote of lotes) {
      const nome = formatarNomePadrao(getLoteNome(lote));
      if (!nome) continue;
      const targets = getLoteTargets(lote);
      if (!targets.length) continue;
      correcoes.push({
        targetIds: targets,
        descricao: nome,
        especie: inferEspecieFromDesc?.(nome, especies) || lote.members[0]?.item?.especie || "",
      });
    }
    return correcoes;
  }, [lotes, loteNomes, loteChecks, inferEspecieFromDesc, especies]);

  const lotePreview = useMemo(() => prepararLoteTotal(), [prepararLoteTotal]);
  const totalItensLote = lotePreview.reduce((s, c) => s + c.targetIds.length, 0);

  const aplicarTodosLotes = async () => {
    if (!lotePreview.length) {
      showT?.("Nenhum lote pronto para aplicar");
      return;
    }
    setConfirmLote(false);
    await onAplicarCorrecao?.(lotePreview);
    setLoteChecks(new Map());
    setLoteNomes(new Map());
  };

  const handleFiltroStat = (id) => {
    if (id === "todos") {
      setFiltroProblema(FILTRO_PROBLEMA.TODOS);
      setModo("revisar");
    } else if (id === "corrigidos") {
      setModo("corrigidos");
    } else if (id === "lotes") {
      setModo("lote");
      setFiltroProblema(FILTRO_PROBLEMA.PRECISA_PADRONIZAR);
    } else {
      setFiltroProblema(id);
      setModo("revisar");
    }
  };

  const toggleLoteOpen = (key) => {
    setLotesAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (modo === "lote" && lotes.length && !lotesAbertos.size) {
      setLotesAbertos(new Set(lotes.slice(0, 3).map((g) => g.key)));
    }
  }, [modo, lotes, lotesAbertos.size]);

  return (
    <div className={`correcao-page${isMob ? " correcao-page--mob" : ""}`}>
      <header className="correcao-hero">
        <h2>Correção de nomes</h2>
        <p>
          Padronize a <strong>descrição</strong> dos itens inventariados. A <strong>marca não é alterada</strong>.
          Selecione os itens, digite o nome padrão e aplique — ou use a padronização automática de grafia.
        </p>
      </header>

      <CorrecaoStats
        stats={stats}
        filtroAtivo={modo === "corrigidos" ? "corrigidos-tab" : filtroProblema}
        onFiltro={handleFiltroStat}
      />

      <div className="correcao-toolbar">
        <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} style={{ ...inp, minWidth: isMob ? "100%" : 200 }}>
          <option value="todas">Todas as unidades</option>
          {(unidades || []).map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <TInput initial={query} onVal={setQuery} placeholder="Buscar nome, marca ou ID…" style={{ ...inp, flex: 1, minWidth: 160 }} />
        {modo !== "corrigidos" && (
          <select
            value={filtroProblema}
            onChange={(e) => setFiltroProblema(e.target.value)}
            style={{ ...inp, minWidth: isMob ? "100%" : 200 }}
          >
            <option value={FILTRO_PROBLEMA.TODOS}>Todos pendentes</option>
            <option value={FILTRO_PROBLEMA.ABREVIACAO}>Com abreviação</option>
            <option value={FILTRO_PROBLEMA.MAIUSCULAS}>Em MAIÚSCULAS</option>
            <option value={FILTRO_PROBLEMA.SEM_FOTO}>Sem foto</option>
            <option value={FILTRO_PROBLEMA.SEM_ESPECIE}>Sem espécie</option>
            <option value={FILTRO_PROBLEMA.BAIXA_QUALIDADE}>Baixa qualidade</option>
          </select>
        )}
        <div className="correcao-tabs">
          <button type="button" className={`gov-btn ${modo === "revisar" ? "gov-btn--primary" : "gov-btn--secondary"}`} style={bs} onClick={() => setModo("revisar")}>
            Padronizar ({stats.precisaPadronizar})
          </button>
          <button type="button" className={`gov-btn ${modo === "corrigidos" ? "gov-btn--primary" : "gov-btn--secondary"}`} style={bs} onClick={() => setModo("corrigidos")}>
            Corrigidos ({stats.jaPadronizados})
          </button>
          <button type="button" className={`gov-btn ${modo === "lote" ? "gov-btn--primary" : "gov-btn--secondary"}`} style={bs} onClick={() => setModo("lote")}>
            Em lote ({lotes.length})
          </button>
        </div>
      </div>

      {modo === "revisar" && (
        <div className={`correcao-layout${isMob ? " correcao-layout--mob" : ""}`}>
          <section>
            <div className="correcao-panel" style={{ ...cd, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div className="correcao-panel__title">Aguardando padronização ({itensPendentes.length})</div>
                  <div style={{ fontSize: 12, color: "var(--gov-text-muted)" }}>
                    Antes → depois da padronização · página {pageSafe}/{totalPages}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="gov-btn gov-btn--secondary" style={bs} onClick={selecionarTudo}>
                    Selecionar tudo ({itensPendentes.length})
                  </button>
                  <button type="button" className="gov-btn gov-btn--secondary" style={bs} onClick={selecionarTodosVisiveis}>
                    Marcar página
                  </button>
                  <button type="button" className="gov-btn gov-btn--ghost" style={bs} onClick={limparSelecao}>Limpar</button>
                </div>
              </div>
            </div>

            <div className="correcao-list">
              {itensPendentes.length === 0 && (
                <div className="correcao-empty">
                  Nenhum item pendente neste filtro. Veja a aba <strong>Corrigidos</strong>.
                </div>
              )}
              {itensPage.map((item) => {
                const label = getItemLabel(item, foundMap);
                const nomePadraoAuto = padronizarNome(label);
                const marca = getItemMarca(item, foundMap);
                const found = getFoundEntry(item.id, foundMap);
                const checked = selecionados.has(item.id);
                const score = computeNomeQualityScore(item, foundMap);
                const problemas = detectProblemasNome(item, foundMap);
                const mudou = true;
                const nomeDestino = nomeAplicar || nomePadraoAuto;
                return (
                  <article
                    key={item.id}
                    className={`correcao-item${checked ? " correcao-item--sel" : ""}${mudou ? " correcao-item--low" : ""}`}
                  >
                    <span className={scoreClass(score)} title="Qualidade do nome">{score}</span>
                    <input
                      type="checkbox"
                      className="correcao-check"
                      checked={checked}
                      onChange={() => toggleSel(item.id)}
                      aria-label={`Selecionar ${label}`}
                    />
                    <CorrecaoItemPhoto foundMap={foundMap} itemId={item.id} onViewImage={onViewImage} />
                    <div className="correcao-item__main">
                      <div className="correcao-item__title">{label}</div>
                      {marca && (
                        <div style={{ fontSize: 11, color: "var(--gov-primary)", fontWeight: 700, marginTop: 4 }}>
                          Marca: {marca} <span style={{ fontWeight: 400, color: "var(--gov-text-muted)" }}>(mantida)</span>
                        </div>
                      )}
                      {checked && nomeDestino && nomeDestino !== label && (
                        <NomeDiff antes={label} depois={nomeDestino} compact />
                      )}
                      {!checked && <NomeDiff antes={label} depois={nomePadraoAuto} compact />}
                      <AtributoChips nome={nomeDestino} marca={marca} />
                      <div className="correcao-item__meta">
                        {item.especie || found?.especieEdit || "—"} · {item.unidadeNome || item.unidadeId} · {item.id}
                      </div>
                      {problemas.length > 0 && (
                        <div className="correcao-item__probs">
                          {problemas.slice(0, 3).map((p) => (
                            <span key={p.id} className={`correcao-prob${p.severidade === "alta" ? " correcao-prob--alta" : ""}`}>
                              {p.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {found?.descricaoEdit && found.descricaoEdit !== item.descricao && (
                        <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Catálogo: {item.descricao || "—"}</div>
                      )}
                    </div>
                    {mudou && (
                      <button
                        type="button"
                        className="gov-btn gov-btn--secondary"
                        style={{ ...bs, whiteSpace: "nowrap" }}
                        disabled={busy}
                        onClick={() => aplicarPadronizacaoItens([item.id])}
                      >
                        Auto
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
                <button type="button" className="gov-btn gov-btn--secondary" style={bs} disabled={pageSafe <= 1} onClick={() => setPageAtiva((p) => Math.max(1, p - 1))}>Anterior</button>
                <button type="button" className="gov-btn gov-btn--secondary" style={bs} disabled={pageSafe >= totalPages} onClick={() => setPageAtiva((p) => Math.min(totalPages, p + 1))}>Próxima</button>
              </div>
            )}
          </section>

          <aside className="correcao-panel correcao-panel--sticky" style={cd}>
            <div className="correcao-panel__title">Nome padrão</div>
            <p style={{ fontSize: 12, color: "var(--gov-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
              Digite o nome e aplique nos itens selecionados. Só a <strong>descrição</strong> muda — a marca permanece.
            </p>
            <label className="correcao-label">Nome para os selecionados</label>
            <TInput
              key={nomePersonalizado ? "nome-edit" : "nome-vazio"}
              initial={nomePersonalizado}
              onVal={setNomePersonalizado}
              placeholder="Ex.: Cadeira de plástico sem braço"
              style={{ ...inp, width: "100%", marginBottom: 10 }}
            />
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              {selecionados.size} item(ns) selecionado(s)
            </p>
            {nomeAplicar && labelPreview && (
              <NomeDiff antes={labelPreview} depois={nomeAplicar} />
            )}
            {especieInferida && (
              <div className="correcao-especie">Espécie inferida: <strong>{especieInferida}</strong></div>
            )}
            <button
              type="button"
              className="gov-btn gov-btn--primary"
              style={{ ...bs, width: "100%", marginTop: 12 }}
              disabled={busy || !selecionados.size || !nomeAplicar}
              onClick={aplicarNomeDigitado}
            >
              Aplicar nome nos {selecionados.size || "…"} selecionado(s)
            </button>
            <button
              type="button"
              className="gov-btn gov-btn--secondary"
              style={{ ...bs, width: "100%", marginTop: 8 }}
              disabled={busy || !selecionados.size}
              onClick={aplicarSelecionados}
            >
              Padronizar grafia automaticamente
            </button>
          </aside>
        </div>
      )}

      {modo === "corrigidos" && (
        <section>
          <div className="correcao-panel" style={{ ...cd, marginBottom: 12 }}>
            <div className="correcao-panel__title">Nomes corrigidos ({itensCorrigidos.length})</div>
            <p style={{ fontSize: 12, color: "var(--gov-text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
              Itens com grafia já padronizada. Eles saem da aba <strong>Padronizar</strong> automaticamente após a correção.
            </p>
          </div>

          <div className="correcao-list">
            {itensCorrigidos.length === 0 && (
              <div className="correcao-empty">Nenhum item corrigido neste filtro ainda.</div>
            )}
            {itensPage.map((item) => {
              const label = getItemLabel(item, foundMap);
              const marca = getItemMarca(item, foundMap);
              const found = getFoundEntry(item.id, foundMap);
              const score = computeNomeQualityScore(item, foundMap);
              return (
                <article key={item.id} className="correcao-item" style={{ borderLeft: "3px solid #16a34a" }}>
                  <span className={scoreClass(score)} title="Qualidade do nome">{score}</span>
                  <span style={{ marginTop: 28, fontSize: 16, color: "#16a34a", flexShrink: 0 }} aria-hidden="true">✓</span>
                  <CorrecaoItemPhoto foundMap={foundMap} itemId={item.id} onViewImage={onViewImage} />
                  <div className="correcao-item__main">
                    <div className="correcao-item__title">{label}</div>
                    {marca && (
                      <div style={{ fontSize: 11, color: "var(--gov-primary)", fontWeight: 700, marginTop: 4 }}>
                        Marca: {marca}
                      </div>
                    )}
                    <AtributoChips nome={label} marca={marca} />
                    <div className="correcao-item__meta">
                      {item.especie || found?.especieEdit || "—"} · {item.unidadeNome || item.unidadeId} · {item.id}
                    </div>
                    <p className="correcao-diff__ok" style={{ marginTop: 6 }}>Nome padronizado</p>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <button type="button" className="gov-btn gov-btn--secondary" style={bs} disabled={pageSafe <= 1} onClick={() => setPageAtiva((p) => Math.max(1, p - 1))}>Anterior</button>
              <button type="button" className="gov-btn gov-btn--secondary" style={bs} disabled={pageSafe >= totalPages} onClick={() => setPageAtiva((p) => Math.min(totalPages, p + 1))}>Próxima</button>
            </div>
          )}
        </section>
      )}

      {modo === "lote" && (
        <>
          <div className="correcao-sugestoes-head">
            <div>
              <div className="correcao-panel__title">{lotes.length} lotes de padronização</div>
              <p style={{ fontSize: 12, color: "var(--gov-text-muted)", margin: "4px 0 0" }}>
                Itens diferentes que ficarão com a mesma grafia padronizada — revise e aplique em massa.
              </p>
            </div>
            {lotes.length > 0 && (
              <button
                type="button"
                className="gov-btn gov-btn--primary"
                style={bs}
                disabled={busy || !lotePreview.length}
                onClick={() => setConfirmLote(true)}
              >
                Padronizar todos ({totalItensLote} itens)
              </button>
            )}
          </div>

          <div className="correcao-sugestoes-list">
            {lotes.length === 0 && (
              <div className="correcao-empty">Nenhum lote pendente. Todos os nomes já estão no padrão.</div>
            )}
            {lotes.map((lote) => {
              const targets = getLoteTargets(lote);
              const nomeFinal = getLoteNome(lote);
              return (
                <PadronizacaoLoteCard
                  key={lote.key}
                  lote={lote}
                  foundMap={foundMap}
                  nomeFinal={nomeFinal}
                  onNomeChange={(v) =>
                    setLoteNomes((prev) => {
                      const next = new Map(prev);
                      next.set(lote.key, formatarNomePadrao(v));
                      return next;
                    })
                  }
                  targets={targets}
                  onToggleMember={(id) => toggleLoteMember(lote.key, id, lote)}
                  onAplicar={() => aplicarLote(lote, targets)}
                  onViewImage={onViewImage}
                  busy={busy}
                  bs={bs}
                  inp={inp}
                  expanded={lotesAbertos.has(lote.key)}
                  onToggleExpand={() => toggleLoteOpen(lote.key)}
                />
              );
            })}
          </div>
        </>
      )}

      {confirmLote && (
        <div className="gov-modal-overlay" role="dialog" aria-modal="true">
          <div className="gov-modal" style={{ maxWidth: 440 }}>
            <h3 style={{ margin: "0 0 8px" }}>Padronizar todos os lotes?</h3>
            <p style={{ fontSize: 13, color: "var(--gov-text-muted)", marginBottom: 16 }}>
              {lotePreview.length} lote(s), {totalItensLote} item(ns) terão a grafia padronizada. Registrado na auditoria.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="gov-btn gov-btn--ghost" style={bs} onClick={() => setConfirmLote(false)}>Cancelar</button>
              <button type="button" className="gov-btn gov-btn--primary" style={bs} disabled={busy} onClick={aplicarTodosLotes}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isMob && modo === "revisar" && selecionados.size > 0 && (
        <div className="correcao-floating-bar">
          <span className="correcao-floating-bar__info">{selecionados.size} selecionado(s)</span>
          <button type="button" className="gov-btn gov-btn--primary" style={bs} disabled={busy || !nomeAplicar} onClick={aplicarNomeDigitado}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

function normalize(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
