import React, { useDeferredValue, useEffect, useMemo } from "react";
import { fsSet, gerarLinkConviteInventariante } from "../../services/firebase.js";
import { logAuditoria } from "../../services/audit.js";
import { garantirCampanhaAberta } from "../../services/campanha.js";
import { PER_PAGE, PER_PAGE_MOBILE } from "../../constants/inventory.js";
import { bumpCacheBuster, setCachedData } from "../../utils/performance.js";
import { gerarTodasSugestoes } from "../../utils/suggestions.js";
import { parseBrDate, sortByDataNF } from "../../utils/itemHelpers.js";
import { detectTombosDuplicados } from "../../utils/tomboDup.js";
import { canDeleteLocal, filterLocaisForSession, resolveUnitForItem } from "../../utils/inventorySession.js";
import { isItemInventariado, normalizePatrimonioId, getFoundEntry } from "../../utils/patrimonioId.js";
import { getAppStyles } from "../../constants/theme.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useUnidades } from "../../hooks/useUnidades.js";
import { useLocais } from "../../hooks/useLocais.js";
import { useFound } from "../../hooks/useFound.js";
import { useInventario } from "../../hooks/useInventario.js";
import { useCampanha } from "../../hooks/useCampanha.js";
import { useOfflineQueue } from "../../hooks/useOfflineQueue.js";
import { useFinalizacoes } from "../../hooks/useFinalizacoes.js";
import { EMPTY_SUGESTOES, getItemCode } from "../helpers/appHelpers.js";

export function useAppData({ firebaseOk, state }) {
  const {
    tab, setTab, modal, finalizadoEdit, setFinalizadoEdit, hideIncorporados,
    search, hideFound, tombosTab, showT, setBusy, formRef, isMob, page,
    setGerandoInvConvite, setInvConviteLink, setInvConviteExp, setModal,
    setGlobalResults, setGlobalSearching,
  } = state;

  const listPageSize = isMob ? PER_PAGE_MOBILE : PER_PAGE;

  const { queueStatus, updateQueueStatus } = useOfflineQueue();
  const { unidades, setUnidades, loadingXlsx, loadXlsx } = useUnidades({ showT });

  const applyDescOverride = React.useCallback((itemId, descEdit, espEdit) => {
    if (!descEdit && !espEdit) return;
    setUnidades((prev) =>
      prev.map((u) => ({
        ...u,
        itens: u.itens.map((i) =>
          i.id === itemId
            ? {
                ...i,
                ...(descEdit ? { descricao: descEdit } : {}),
                ...(espEdit ? { especie: espEdit } : {}),
              }
            : i
        ),
      }))
    );
  }, [setUnidades]);

  const found = useFound({ showT, applyDescOverride });
  const locais = useLocais();

  const inventario = useInventario({ unidades, foundSet: found.foundSet });
  const unidadeAtiva = inventario.unidadesAtivas[0] || finalizadoEdit?.units?.[0] || null;

  const editScopeUnits = useMemo(
    () => (finalizadoEdit?.units?.length ? finalizadoEdit.units : inventario.unidadesAtivas),
    [finalizadoEdit, inventario.unidadesAtivas]
  );

  const editScopeSessionId = useMemo(() => {
    if (finalizadoEdit?.fin) {
      return finalizadoEdit.fin.sessionId || `fin_${finalizadoEdit.fin.id}`;
    }
    return inventario.sessionId;
  }, [finalizadoEdit, inventario.sessionId]);

  const scopeAllItens = useMemo(
    () => editScopeUnits.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome }))),
    [editScopeUnits]
  );

  const resolveItemUnit = React.useCallback(
    (item) => {
      if (!item) return unidadeAtiva;
      return (
        resolveUnitForItem(item, editScopeUnits, unidadeAtiva) ||
        unidades.find((u) => u.id === item.unidadeId) ||
        (item.unidadeId ? { id: item.unidadeId, nome: item.unidadeNome || "" } : null) ||
        unidadeAtiva
      );
    },
    [editScopeUnits, unidadeAtiva, unidades]
  );

  const activeUnitIdList = useMemo(() => editScopeUnits.map((u) => u.id).filter(Boolean), [editScopeUnits]);
  const isFinalizadoScope = Boolean(finalizadoEdit?.fin);

  const sessionLocais = useMemo(
    () =>
      filterLocaisForSession(locais.locais, editScopeSessionId, activeUnitIdList, found.foundMap, {
        finalizedMode: isFinalizadoScope,
      }),
    [locais.locais, editScopeSessionId, activeUnitIdList, found.foundMap, isFinalizadoScope]
  );

  const pickLocais = useMemo(
    () =>
      filterLocaisForSession(locais.locais, editScopeSessionId, activeUnitIdList, found.foundMap, {
        includeReferenced: true,
        finalizedMode: isFinalizadoScope,
      }),
    [locais.locais, editScopeSessionId, activeUnitIdList, found.foundMap, isFinalizadoScope]
  );

  const handleDeleteLocal = React.useCallback(
    async (l) => {
      if (!canDeleteLocal(l, editScopeSessionId, activeUnitIdList)) {
        showT("Local de outra unidade — não pode remover");
        return;
      }
      await locais.deleteLocal(l, { updateQueueStatus });
      showT("Local removido");
    },
    [editScopeSessionId, activeUnitIdList, locais.deleteLocal, showT, updateQueueStatus]
  );

  const createSessionLocal = React.useCallback(
    async (nome, desc = "") => {
      const unitIds = editScopeUnits.map((u) => u.id).filter(Boolean);
      if (!unitIds.length) {
        showT("Nenhuma unidade selecionada");
        return null;
      }
      const sid = editScopeSessionId || inventario.sessionId;
      if (!sid) {
        showT("Inicie o inventário ou abra um finalizado para criar locais");
        return null;
      }
      return locais.createLocal(
        {
          nome,
          desc,
          sessionId: sid,
          unidadeIds: unitIds.length === 1 ? unitIds : unitIds,
        },
        { updateQueueStatus }
      );
    },
    [editScopeSessionId, editScopeUnits, inventario.sessionId, locais.createLocal, showT, updateQueueStatus]
  );

  const loadAfterAuth = React.useCallback(async () => {
    await loadXlsx(false);
    await Promise.all([found.loadFoundAndTombos([], { cacheOnly: true }), locais.loadLocais([], { cacheOnly: true })]);
    // Atualiza em segundo plano com TODOS os registros do servidor, para que os
    // menus Itens/Dashboard/Correção mostrem os encontrados sem sessão ativa.
    found.loadFoundAndTombos([], { allUnits: true }).catch((e) => {
      console.warn("Refresh completo do inventário falhou:", e?.message || e);
    });
  }, [loadXlsx, found.loadFoundAndTombos, locais.loadLocais]);

  const auth = useAuth({ firebaseOk, loadAfterAuth, showT });
  const campanhaState = useCampanha({ logado: auth.logado });
  const finalizacoesState = useFinalizacoes({ logado: auth.logado, tombosNE: found.tombosNE, unidades });

  useEffect(() => {
    if (!auth.logado) return;
    campanhaState.refresh?.();
    if (auth.logado.role === "admin") {
      garantirCampanhaAberta([], auth.logado.email || "").catch(() => {});
    }
  }, [auth.logado?.uid, auth.logado?.role]);

  const assertCampanhaAberta = React.useCallback(() => {
    if (campanhaState.fechada) {
      showT("Inventário fechado — alterações não permitidas");
      return false;
    }
    return true;
  }, [campanhaState.fechada, showT]);

  const abrirConvidarColega = React.useCallback(async () => {
    setGerandoInvConvite(true);
    setInvConviteLink("");
    setInvConviteExp("");
    setModal("convite-inventariante");
    try {
      const { convite, link } = await gerarLinkConviteInventariante();
      setInvConviteLink(link);
      setInvConviteExp(convite.dataExpiracao || "");
    } catch (e) {
      showT(e?.message || "Erro ao gerar convite");
      setModal(null);
    } finally {
      setGerandoInvConvite(false);
    }
  }, [showT]);

  const assertPodeEditar = React.useCallback(() => {
    const role = auth.logado?.role;
    if (campanhaState.fechada && role !== "admin" && role !== "inventariante") {
      showT("Inventário fechado — alterações não permitidas");
      return false;
    }
    return true;
  }, [campanhaState.fechada, auth.logado?.role, showT]);

  // Depois de assertPodeEditar — usa auth/campanhaState, que só existem aqui.
  const handleDeleteInventariado = React.useCallback(
    async (item) => {
      if (!assertPodeEditar()) return false;
      if (!item?.id) return false;
      const f = getFoundEntry(item.id, found.foundMap);
      if (!f) {
        showT("Item não está na lista de inventariados");
        return false;
      }
      const label = f.descricaoEdit || item.descricao || item.especie || item.id;
      const ok = window.confirm(
        `Remover "${label}" da lista de inventariados?\n\nO item voltará a ficar pendente. A marca e os dados do patrimônio não são apagados.`
      );
      if (!ok) return false;
      await found.deleteFound(item.id);
      showT("Item removido do inventário");
      return true;
    },
    [assertPodeEditar, found, showT]
  );

  useEffect(() => {
    if (!auth.logado || unidades.length === 0) return;

    // Nomes / Itens / Dashboard precisam do inventário de TODAS as unidades —
    // não só da sessão ativa de inventariar.
    if (tab === "correcao" || tab === "itens" || tab === "dash") {
      found.loadFoundAndTombos([], { allUnits: true }).catch((e) => {
        console.warn("Refresh completo do inventário falhou:", e?.message || e);
      });
      return;
    }

    const scopeUnits = finalizadoEdit?.units?.length ? finalizadoEdit.units : inventario.unidadesAtivas;
    if (scopeUnits.length === 0) return;
    const ids = scopeUnits.map((u) => u.id).filter(Boolean);
    const scopeItems = scopeUnits.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome })));
    const keepItemIds = scopeItems.map((i) => i.id);
    const itemUnits = new Map(scopeItems.map((i) => [i.id, { unidadeId: i.unidadeId, unidadeNome: i.unidadeNome }]));
    const localIds = [
      ...new Set(
        Object.values(found.foundMap || {})
          .filter((f) => f?.localId)
          .map((f) => f.localId)
      ),
    ];
    found.loadFoundAndTombos(ids, {
      keepItemIds,
      itemUnits,
    });
    locais.loadLocais(ids, { localIds });
  }, [
    auth.logado?.uid,
    tab,
    finalizadoEdit?.fin?.id,
    inventario.unidadesAtivas.map((u) => u.id).join(","),
    unidades.length,
    found.loadFoundAndTombos,
    locais.loadLocais,
  ]);


  const activeUnitIds = React.useMemo(
    () => inventario.unidadesAtivas.map((u) => u.id).filter(Boolean),
    [inventario.unidadesAtivas]
  );

  const todosItens = React.useMemo(
    () => unidades.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeNome: u.nome, unidadeId: u.id }))),
    [unidades]
  );

  const needsSugestoes =
    tab === "inventario" || tab === "correcao" || modal === "manual" || modal === "detalhe" || modal === "semTombo";

  const sugestoes = React.useMemo(() => {
    if (!needsSugestoes) return EMPTY_SUGESTOES;
    return gerarTodasSugestoes(todosItens);
  }, [needsSugestoes, todosItens]);

  const tombosDup = React.useMemo(() => {
    if (tab !== "tombos") return [];
    return detectTombosDuplicados(todosItens, found.found);
  }, [tab, todosItens, found.found]);

  const parseNFDate = parseBrDate;

  const nfDataMap = React.useMemo(() => {
    if (tab !== "nf") return {};
    const map = {};
    for (const item of todosItens) {
      const nf = (item.nf || "").trim();
      if (!nf) continue;
      if (!map[nf]) {
        map[nf] = {
          nf,
          dataNF: item.dataNF || "",
          fornecedor: item.fornecedor || "",
          tipoEntrada: item.tipoEntrada || "Próprio",
          itens: [],
          valorTotal: 0,
          valorAtualTotal: 0,
        };
      }
      map[nf].itens.push(item);
      map[nf].valorTotal += Number(item.valor || 0) || 0;
      map[nf].valorAtualTotal += Number(item.valorAtual || 0) || 0;
      if (!map[nf].dataNF && item.dataNF) map[nf].dataNF = item.dataNF;
      if (!map[nf].fornecedor && item.fornecedor) map[nf].fornecedor = item.fornecedor;
      if (!map[nf].tipoEntrada && item.tipoEntrada) map[nf].tipoEntrada = item.tipoEntrada;
    }
    return map;
  }, [tab, todosItens]);
  const nfDataList = React.useMemo(
    () => Object.values(nfDataMap).sort((a, b) => parseNFDate(b.dataNF) - parseNFDate(a.dataNF)),
    [nfDataMap, parseNFDate]
  );
  const NF_PER_PAGE = 15;

  const xlsxCorrompidos = todosItens.filter((i) => {
    const noText = !String(i.descricao || "").trim() && !String(i.especie || "").trim() && !String(i.fornecedor || "").trim() && !String(i.marca || "").trim();
    const noNums = !(Number(i.valor || 0) || 0) && !(Number(i.valorAtual || 0) || 0);
    const noDocs = !String(i.nf || "").trim() && !String(i.dataNF || "").trim() && !String(i.empenho || "").trim();
    const noDate = !String(i.data || "").trim();
    return noText && noNums && noDocs && noDate;
  });

  const deferredSearch = useDeferredValue(search);

  const sessionItens = React.useMemo(
    () =>
      inventario.allItens.filter((i) => !hideIncorporados || (i.tipoEntrada || "Próprio") !== "Incorporado"),
    [inventario.allItens, hideIncorporados]
  );

  const sessionTotalBens = sessionItens.length;
  const sessionTotalFound = React.useMemo(
    () => sessionItens.filter((i) => isItemInventariado(i.id, found.foundSet)).length,
    [sessionItens, found.foundSet]
  );
  const sessionProgresso = sessionTotalBens > 0 ? Math.round((sessionTotalFound / sessionTotalBens) * 100) : 0;

  const filtered = React.useMemo(() => {
    const s = deferredSearch.toLowerCase();
    return sessionItens.filter((i) => {
      if (hideFound && isItemInventariado(i.id, found.foundSet)) return false;
      return (
        !s ||
        getItemCode(i).toLowerCase().includes(s) ||
        (i.id || "").toLowerCase().includes(s) ||
        (i.especie || "").toLowerCase().includes(s) ||
        (i.descricao || "").toLowerCase().includes(s) ||
        (i.fornecedor || "").toLowerCase().includes(s) ||
        (found.foundMap[i.id]?.descricaoEdit || "").toLowerCase().includes(s) ||
        (found.foundMap[i.id]?.permutaDesc || "").toLowerCase().includes(s) ||
        (found.foundMap[i.id]?.permutaMarca || "").toLowerCase().includes(s)
      );
    });
  }, [sessionItens, hideFound, found.foundSet, found.foundMap, deferredSearch]);
  const sortedFiltered = useMemo(() => [...filtered].sort(sortByDataNF), [filtered]);
  const totalPages = Math.ceil(sortedFiltered.length / listPageSize);
  const paged = sortedFiltered.slice((page - 1) * listPageSize, page * listPageSize);

  const origemMeta = {
    Próprio: { bg: "#dbeafe", tx: "#1d4ed8", ico: "" },
    Doação: { bg: "#fef3c7", tx: "#92400e", ico: "" },
    Incorporado: { bg: "#d1fae5", tx: "#065f46", ico: "" },
    Permuta: { bg: "#ede9fe", tx: "#6d28d9", ico: "" },
  };

  const { inp, bp, bs, cd } = getAppStyles(isMob);

  const isAdmin = auth.logado?.role === "admin";
  const isInventariante = auth.logado?.role === "inventariante";
  const canGerirCoord = isAdmin || isInventariante;
  const navs = [
    { id: "inventario", l: "Inventário", badge: inventario.unidadesAtivas.length > 0 ? inventario.unidadesAtivas.length : null },
    { id: "finalizados", l: "Finalizados", badge: finalizacoesState.finalizacoes?.length || null },
    { id: "busca", l: "Busca" },
    { id: "itens", l: "Itens" },
    { id: "nf", l: "Notas" },
    { id: "tombos", l: "Tombos", badge: tombosDup.length > 0 ? tombosDup.length : null },
    { id: "dash", l: "Dashboard" },
    ...(canGerirCoord ? [{ id: "coordenadores", l: "Coordenadores" }] : []),
    ...(canGerirCoord ? [{ id: "correcao", l: "Nomes" }] : []),
    ...(isAdmin ? [{ id: "inventariantes", l: "Inventariantes" }] : []),
  ];

  useEffect(() => {
    if (!canGerirCoord && tab === "coordenadores") setTab("inventario");
    if (!canGerirCoord && tab === "correcao") setTab("inventario");
    if (!isAdmin && tab === "inventariantes") setTab("inventario");
  }, [isAdmin, canGerirCoord, tab]);

  const doGlobalSearch = async (q) => {
    if (!q || q.trim().length < 2) {
      setGlobalResults([]);
      return;
    }
    setGlobalSearching(true);
    const term = q.toLowerCase().trim();
    const results = [];
    for (const unidade of unidades) {
      for (const item of unidade.itens) {
        if (
          item.id.includes(term) ||
          (item.descricao || "").toLowerCase().includes(term) ||
          (item.especie || "").toLowerCase().includes(term) ||
          (item.fornecedor || "").toLowerCase().includes(term) ||
          (item.marca || "").toLowerCase().includes(term) ||
          (item.nf || "").toLowerCase().includes(term) ||
          (found.foundMap[item.id]?.descricaoEdit || "").toLowerCase().includes(term) ||
          (found.foundMap[item.id]?.permutaDesc || "").toLowerCase().includes(term) ||
          (found.foundMap[item.id]?.permutaMarca || "").toLowerCase().includes(term)
        ) {
          results.push({ ...item, unidadeNome: unidade.nome, unidadeId: unidade.id });
          if (results.length >= 200) break;
        }
      }
      if (results.length >= 200) break;
    }
    setGlobalResults(results);
    setGlobalSearching(false);
  };

  return { queueStatus, updateQueueStatus, unidades, setUnidades, loadingXlsx, loadXlsx,
    found, locais, inventario, unidadeAtiva, editScopeUnits, editScopeSessionId,
    scopeAllItens, resolveItemUnit, activeUnitIdList, isFinalizadoScope,
    sessionLocais, pickLocais, handleDeleteLocal, handleDeleteInventariado, createSessionLocal,
    auth, campanhaState, finalizacoesState, assertPodeEditar, abrirConvidarColega,
    activeUnitIds, todosItens, sugestoes, tombosDup, nfDataList, NF_PER_PAGE,
    xlsxCorrompidos, sessionTotalFound, sessionTotalBens, sessionProgresso,
    sortedFiltered, totalPages, paged, origemMeta, inp, bp, bs, cd,
    isAdmin, isInventariante, canGerirCoord, navs, doGlobalSearch, deferredSearch };
}
