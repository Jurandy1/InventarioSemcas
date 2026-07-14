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
  getItemEspecie,
  getItemLabel,
  getItemMarca,
  getItemFotos,
  groupItemsByEspecie,
  padronizarNome,
} from "../utils/nomeCorrecao.js";
import { getFoundEntry } from "../utils/patrimonioId.js";
import { isGeminiNomeConfigured, sugerirNomeComGemini } from "../services/geminiNome.js";
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
  onOpenItem,
  showT,
  busy,
  isMob,
  inp,
  cd,
  bs,
}) {
  const [modo, setModo] = useState("revisar");
  const [unidadeId, setUnidadeId] = useState("todas");
  const [especieFiltro, setEspecieFiltro] = useState("todas");
  const [somenteManuais, setSomenteManuais] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroProblema, setFiltroProblema] = useState(FILTRO_PROBLEMA.TODOS);
  const [nomePersonalizado, setNomePersonalizado] = useState("");
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [loteChecks, setLoteChecks] = useState(() => new Map());
  const [loteNomes, setLoteNomes] = useState(() => new Map());
  const [lotesAbertos, setLotesAbertos] = useState(() => new Set());
  const [especiesAbertas, setEspeciesAbertas] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageCorrigidos, setPageCorrigidos] = useState(1);
  const [confirmLote, setConfirmLote] = useState(false);
  const [iaBusy, setIaBusy] = useState(false);
  const [nomeInputKey, setNomeInputKey] = useState(0);
  const [especieIa, setEspecieIa] = useState("");
  const [loteEspecies, setLoteEspecies] = useState(() => new Map());
  const geminiOk = isGeminiNomeConfigured();

  const filtroBase = useMemo(
    () => ({ unidadeId, somenteManuais, especie: especieFiltro }),
    [unidadeId, somenteManuais, especieFiltro]
  );

  const lotes = useMemo(
    () => agruparItensParaPadronizacao(todosItens, foundMap, foundSet, filtroBase),
    [todosItens, foundMap, foundSet, filtroBase]
  );

  const stats = useMemo(
    () => buildCorrecaoDashboard(todosItens, foundMap, foundSet, lotes, { somenteManuais }),
    [todosItens, foundMap, foundSet, lotes, somenteManuais]
  );

  const itensPendentes = useMemo(
    () =>
      filterInventariadosItems(todosItens, foundMap, foundSet, {
        ...filtroBase,
        query,
        filtroProblema,
        estadoLista: ESTADO_LISTA.PENDENTES,
      }),
    [todosItens, foundMap, foundSet, filtroBase, query, filtroProblema]
  );

  const itensCorrigidos = useMemo(
    () =>
      filterInventariadosItems(todosItens, foundMap, foundSet, {
        ...filtroBase,
        query,
        filtroProblema: FILTRO_PROBLEMA.TODOS,
        estadoLista: ESTADO_LISTA.CORRIGIDOS,
      }),
    [todosItens, foundMap, foundSet, filtroBase, query]
  );

  const especiesDisponiveis = useMemo(() => {
    const base = filterInventariadosItems(todosItens, foundMap, foundSet, {
      unidadeId,
      somenteManuais,
      especie: "todas",
      estadoLista: ESTADO_LISTA.PENDENTES,
    });
    return groupItemsByEspecie(base, foundMap);
  }, [todosItens, foundMap, foundSet, unidadeId, somenteManuais]);

  const gruposPendentes = useMemo(
    () => groupItemsByEspecie(itensPendentes, foundMap),
    [itensPendentes, foundMap]
  );

  const itensLista = modo === "corrigidos" ? itensCorrigidos : itensPendentes;

  const perPage = isMob ? PER_PAGE_MOB : PER_PAGE_DESK;
  const pageAtiva = modo === "corrigidos" ? pageCorrigidos : page;
  const setPageAtiva = modo === "corrigidos" ? setPageCorrigidos : setPage;
  // Agrupado por espécie: sem paginação flat (facilita corrigir uma espécie de cada vez).
  const agruparPorEspecie = modo === "revisar" && especieFiltro === "todas";
  const totalPages = agruparPorEspecie ? 1 : Math.max(1, Math.ceil(itensLista.length / perPage));
  const pageSafe = Math.min(pageAtiva, totalPages);
  const itensPage = agruparPorEspecie
    ? itensLista
    : itensLista.slice((pageSafe - 1) * perPage, pageSafe * perPage);

  useEffect(() => {
    setPage(1);
    setPageCorrigidos(1);
  }, [unidadeId, query, filtroProblema, modo, especieFiltro, somenteManuais]);

  useEffect(() => {
    if (gruposPendentes.length && !especiesAbertas.size) {
      setEspeciesAbertas(new Set(gruposPendentes.slice(0, 2).map((g) => g.especie)));
    }
  }, [gruposPendentes, especiesAbertas.size]);

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

  const selecionarEspecie = (members) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const item of members || []) next.add(item.id);
      return next;
    });
    showT?.(`${(members || []).length} item(ns) da espécie selecionado(s)`);
  };

  const toggleEspecieOpen = (esp) => {
    setEspeciesAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(esp)) next.delete(esp);
      else next.add(esp);
      return next;
    });
  };

  const nomeAplicar = formatarNomePadrao(nomePersonalizado.trim());
  const primeiroSel = [...selecionados][0];
  const itemPreview = primeiroSel ? todosItens.find((i) => i.id === primeiroSel) : null;
  const labelPreview = itemPreview ? getItemLabel(itemPreview, foundMap) : "";
  const especieAplicar =
    String(especieIa || "").trim() ||
    (nomeAplicar && inferEspecieFromDesc
      ? inferEspecieFromDesc(nomeAplicar, especies) || itemPreview?.especie || ""
      : "") ||
    "";

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
      especie: especieAplicar,
    });
    setSelecionados(new Set());
    setNomePersonalizado("");
    setEspecieIa("");
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

  const pickItemComFoto = useCallback(
    (ids) => {
      const list = (ids || []).map((id) => todosItens.find((i) => i.id === id)).filter(Boolean);
      return list.find((i) => getItemFotos(i.id, foundMap).length > 0) || list[0] || null;
    },
    [todosItens, foundMap]
  );

  const sugerirComIa = useCallback(
    async (ids) => {
      if (!geminiOk) {
        showT?.("Configure VITE_GEMINI_API_KEY nas Environment Variables da Vercel e faça Redeploy");
        return;
      }
      const alvoIds = ids?.length ? ids : [...selecionados];
      const item = pickItemComFoto(alvoIds);
      if (!item) {
        showT?.("Selecione ao menos um item");
        return;
      }
      const fotos = getItemFotos(item.id, foundMap);
      if (!fotos.length) {
        showT?.("O item precisa ter foto para a IA analisar");
        return;
      }
      setIaBusy(true);
      try {
        const { nome, especie } = await sugerirNomeComGemini({
          fotoUrls: fotos,
          especie: getItemEspecie(item, foundMap),
          nomeAtual: getItemLabel(item, foundMap),
          marca: getItemMarca(item, foundMap),
          especies,
        });
        const limpo = formatarNomePadrao(nome);
        const esp =
          especie ||
          inferEspecieFromDesc?.(limpo, especies) ||
          getItemEspecie(item, foundMap);
        setNomePersonalizado(limpo);
        setEspecieIa(esp);
        setNomeInputKey((k) => k + 1);
        if (!selecionados.size && alvoIds.length) {
          setSelecionados(new Set(alvoIds));
        }
        showT?.(`IA: ${limpo}${esp ? ` · ${esp}` : ""}`);
      } catch (e) {
        showT?.(e?.message || "Falha ao consultar a Gemini");
      } finally {
        setIaBusy(false);
      }
    },
    [geminiOk, selecionados, pickItemComFoto, foundMap, showT, especies, inferEspecieFromDesc]
  );

  const sugerirIaNoLote = useCallback(
    async (lote) => {
      if (!geminiOk) {
        showT?.("Configure VITE_GEMINI_API_KEY nas Environment Variables da Vercel e faça Redeploy");
        return;
      }
      const member = (lote.members || []).find((m) => getItemFotos(m.id, foundMap).length) || lote.members?.[0];
      if (!member) {
        showT?.("Lote sem itens");
        return;
      }
      const fotos = getItemFotos(member.id, foundMap);
      if (!fotos.length) {
        showT?.("Inclua foto em um item do lote para analisar com IA");
        return;
      }
      setIaBusy(true);
      try {
        const { nome, especie } = await sugerirNomeComGemini({
          fotoUrls: fotos,
          especie: getItemEspecie(member.item, foundMap),
          nomeAtual: member.labelOriginal || getItemLabel(member.item, foundMap),
          marca: member.marca || getItemMarca(member.item, foundMap),
          especies,
        });
        const limpo = formatarNomePadrao(nome);
        const esp =
          especie ||
          inferEspecieFromDesc?.(limpo, especies) ||
          getItemEspecie(member.item, foundMap);
        setLoteNomes((prev) => {
          const next = new Map(prev);
          next.set(lote.key, limpo);
          return next;
        });
        setLoteEspecies((prev) => {
          const next = new Map(prev);
          next.set(lote.key, esp);
          return next;
        });
        showT?.(`IA no lote: ${limpo}${esp ? ` · ${esp}` : ""}`);
      } catch (e) {
        showT?.(e?.message || "Falha ao consultar a Gemini");
      } finally {
        setIaBusy(false);
      }
    },
    [geminiOk, foundMap, showT, especies, inferEspecieFromDesc]
  );

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
    const esp =
      String(loteEspecies.get(lote.key) || "").trim() ||
      inferEspecieFromDesc?.(descricao, especies) ||
      lote.members[0]?.item?.especie ||
      "";
    await onAplicarCorrecao?.({
      targetIds,
      descricao,
      especie: esp,
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
    setLoteEspecies((prev) => {
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
      const esp =
        String(loteEspecies.get(lote.key) || "").trim() ||
        inferEspecieFromDesc?.(nome, especies) ||
        lote.members[0]?.item?.especie ||
        "";
      correcoes.push({
        targetIds: targets,
        descricao: nome,
        especie: esp,
      });
    }
    return correcoes;
  }, [lotes, loteNomes, loteChecks, loteEspecies, inferEspecieFromDesc, especies]);

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
    setLoteEspecies(new Map());
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

  const renderItemCard = (item) => {
    const label = getItemLabel(item, foundMap);
    const nomePadraoAuto = padronizarNome(label);
    const marca = getItemMarca(item, foundMap);
    const found = getFoundEntry(item.id, foundMap);
    const checked = selecionados.has(item.id);
    const score = computeNomeQualityScore(item, foundMap);
    const problemas = detectProblemasNome(item, foundMap);
    const nomeDestino = nomeAplicar || nomePadraoAuto;
    const especie = getItemEspecie(item, foundMap);
    return (
      <article
        key={item.id}
        className={`correcao-item${checked ? " correcao-item--sel" : ""} correcao-item--low`}
      >
        <span className={scoreClass(score)} title="Qualidade do nome">{score}</span>
        <input
          type="checkbox"
          className="correcao-check"
          checked={checked}
          onChange={() => toggleSel(item.id)}
          aria-label={`Selecionar ${label}`}
        />
        <CorrecaoItemPhoto foundMap={foundMap} itemId={item.id} onViewImage={onViewImage} onAddPhoto={onOpenItem ? () => onOpenItem(item) : undefined} />
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
            {especie} · {item.unidadeNome || item.unidadeId} · {item.id}
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
        <button
          type="button"
          className="gov-btn gov-btn--secondary"
          style={{ ...bs, whiteSpace: "nowrap" }}
          disabled={busy || iaBusy}
          onClick={() => aplicarPadronizacaoItens([item.id])}
        >
          Auto
        </button>
        <button
          type="button"
          className="gov-btn gov-btn--primary"
          style={{ ...bs, whiteSpace: "nowrap" }}
          disabled={busy || iaBusy || !getItemFotos(item.id, foundMap).length}
          title={
            !geminiOk
              ? "Configure VITE_GEMINI_API_KEY na Vercel"
              : getItemFotos(item.id, foundMap).length
                ? "Analisar foto: nome + espécie"
                : "Sem foto"
          }
          onClick={() => sugerirComIa([item.id])}
        >
          {iaBusy ? "…" : "IA"}
        </button>
      </article>
    );
  };

  return (
    <div className={`correcao-page${isMob ? " correcao-page--mob" : ""}`}>
      <header className="correcao-hero">
        <h2>Correção de nomes</h2>
        <p>
          Foque nos <strong>itens manuais</strong> (sem tombo / digitados). Itens lidos pelo tombo
          já vêm com nome de catálogo e normalmente <strong>não precisam</strong> de padronização.
          Organize por <strong>espécie</strong>. Com foto, use <strong>Analisar com IA</strong> —
          a Gemini sugere nome e espécie corretos para você revisar e aplicar.
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
        <select
          value={especieFiltro}
          onChange={(e) => setEspecieFiltro(e.target.value)}
          style={{ ...inp, minWidth: isMob ? "100%" : 200 }}
          title="Filtrar por espécie"
        >
          <option value="todas">Todas as espécies ({especiesDisponiveis.reduce((s, g) => s + g.count, 0)})</option>
          {especiesDisponiveis.map((g) => (
            <option key={g.especie} value={g.especie}>
              {g.especie} ({g.count})
            </option>
          ))}
        </select>
        <TInput initial={query} onVal={setQuery} placeholder="Buscar nome, marca, espécie ou ID…" style={{ ...inp, flex: 1, minWidth: 160 }} />
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
        <label className="correcao-toggle" title="Itens do tombo já vêm padronizados na planilha">
          <input
            type="checkbox"
            checked={!somenteManuais}
            onChange={(e) => setSomenteManuais(!e.target.checked)}
          />
          Incluir itens do tombo
        </label>
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
                  <div className="correcao-panel__title">
                    Manuais pendentes ({itensPendentes.length})
                    {agruparPorEspecie ? ` · ${gruposPendentes.length} espécie(s)` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gov-text-muted)" }}>
                    {somenteManuais
                      ? "Só itens manuais / sem tombo — nomes digitados na coleta."
                      : "Incluindo itens do tombo (catálogo)."}
                    {agruparPorEspecie ? " Agrupado por espécie." : ` · página ${pageSafe}/${totalPages}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="gov-btn gov-btn--secondary" style={bs} onClick={selecionarTudo}>
                    Selecionar tudo ({itensPendentes.length})
                  </button>
                  {!agruparPorEspecie && (
                    <button type="button" className="gov-btn gov-btn--secondary" style={bs} onClick={selecionarTodosVisiveis}>
                      Marcar página
                    </button>
                  )}
                  <button type="button" className="gov-btn gov-btn--ghost" style={bs} onClick={limparSelecao}>Limpar</button>
                </div>
              </div>
            </div>

            {agruparPorEspecie && gruposPendentes.length > 0 && (
              <div className="correcao-especie-chips" role="tablist" aria-label="Espécies pendentes">
                {gruposPendentes.map((g) => (
                  <button
                    key={g.especie}
                    type="button"
                    className={`correcao-especie-chip${especieFiltro === g.especie ? " correcao-especie-chip--on" : ""}`}
                    onClick={() => setEspecieFiltro(g.especie)}
                  >
                    {g.especie} <strong>{g.count}</strong>
                  </button>
                ))}
              </div>
            )}

            <div className="correcao-list">
              {itensPendentes.length === 0 && (
                <div className="correcao-empty">
                  Nenhum item manual pendente neste filtro. Veja a aba <strong>Corrigidos</strong>
                  {!somenteManuais ? "" : " ou ative “Incluir itens do tombo” se precisar."}
                </div>
              )}

              {agruparPorEspecie
                ? gruposPendentes.map((grupo) => {
                    const aberto = especiesAbertas.has(grupo.especie);
                    return (
                      <section key={grupo.especie} className="correcao-especie-group">
                        <header className="correcao-especie-group__head">
                          <button type="button" className="correcao-especie-group__toggle" onClick={() => toggleEspecieOpen(grupo.especie)}>
                            <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
                            <span className="correcao-especie-group__title">{grupo.especie}</span>
                            <span className="correcao-especie-group__count">{grupo.count}</span>
                          </button>
                          <div className="correcao-especie-group__actions">
                            <button type="button" className="gov-btn gov-btn--ghost" style={bs} onClick={() => setEspecieFiltro(grupo.especie)}>
                              Só esta
                            </button>
                            <button type="button" className="gov-btn gov-btn--secondary" style={bs} onClick={() => selecionarEspecie(grupo.members)}>
                              Selecionar
                            </button>
                          </div>
                        </header>
                        {aberto && grupo.members.map((item) => renderItemCard(item))}
                      </section>
                    );
                  })
                : itensPage.map((item) => renderItemCard(item))}
            </div>

            {totalPages > 1 && !agruparPorEspecie && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
                <button type="button" className="gov-btn gov-btn--secondary" style={bs} disabled={pageSafe <= 1} onClick={() => setPageAtiva((p) => Math.max(1, p - 1))}>Anterior</button>
                <button type="button" className="gov-btn gov-btn--secondary" style={bs} disabled={pageSafe >= totalPages} onClick={() => setPageAtiva((p) => Math.min(totalPages, p + 1))}>Próxima</button>
              </div>
            )}
          </section>

          <aside className="correcao-panel correcao-panel--sticky" style={cd}>
            <div className="correcao-panel__title">Nome e espécie</div>
            <p style={{ fontSize: 12, color: "var(--gov-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
              Selecione itens com foto e clique em <strong>Analisar com IA</strong> — a Gemini sugere
              descrição e espécie. Revise e aplique. A marca não muda.
            </p>
            <button
              type="button"
              className="gov-btn gov-btn--primary correcao-ia-btn"
              style={{ ...bs, width: "100%", marginBottom: 12 }}
              disabled={busy || iaBusy || !selecionados.size}
              onClick={() => sugerirComIa([...selecionados])}
              title={geminiOk ? "Analisa a foto: nome + espécie" : "Falta VITE_GEMINI_API_KEY na Vercel"}
            >
              {iaBusy ? "Analisando foto…" : "Analisar com IA"}
            </button>
            {!geminiOk && (
              <p style={{ fontSize: 11, color: "#b45309", marginTop: -6, marginBottom: 10, lineHeight: 1.4 }}>
                Falta <code>VITE_GEMINI_API_KEY</code> na Vercel + Redeploy.
              </p>
            )}
            <label className="correcao-label">Nome para os selecionados</label>
            <TInput
              key={`nome-${nomeInputKey}`}
              initial={nomePersonalizado}
              onVal={setNomePersonalizado}
              placeholder="Ex.: Cadeira de plástico sem braço"
              style={{ ...inp, width: "100%", marginBottom: 10 }}
            />
            <label className="correcao-label">Espécie</label>
            <TInput
              key={`esp-${nomeInputKey}-${especieIa}`}
              initial={especieIa}
              onVal={setEspecieIa}
              suggestions={especies}
              placeholder="Ex.: CADEIRA"
              style={{ ...inp, width: "100%", marginBottom: 10 }}
            />
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              {selecionados.size} item(ns) selecionado(s)
            </p>
            {nomeAplicar && labelPreview && (
              <NomeDiff antes={labelPreview} depois={nomeAplicar} />
            )}
            {especieAplicar && (
              <div className="correcao-especie">Espécie: <strong>{especieAplicar}</strong></div>
            )}
            <button
              type="button"
              className="gov-btn gov-btn--primary"
              style={{ ...bs, width: "100%", marginTop: 12 }}
              disabled={busy || !selecionados.size || !nomeAplicar}
              onClick={aplicarNomeDigitado}
            >
              Aplicar nome e espécie ({selecionados.size || "…"})
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
              {somenteManuais ? "Itens manuais" : "Itens"} com grafia ok. Saem da aba <strong>Padronizar</strong> após a correção.
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
                  <CorrecaoItemPhoto foundMap={foundMap} itemId={item.id} onViewImage={onViewImage} onAddPhoto={onOpenItem ? () => onOpenItem(item) : undefined} />
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
                  onSugerirIa={() => sugerirIaNoLote(lote)}
                  onViewImage={onViewImage}
                  busy={busy}
                  iaBusy={iaBusy}
                  geminiOk={geminiOk}
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
          <button
            type="button"
            className="gov-btn gov-btn--secondary"
            style={bs}
            disabled={busy || iaBusy}
            onClick={() => sugerirComIa([...selecionados])}
          >
            {iaBusy ? "…" : "IA"}
          </button>
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
