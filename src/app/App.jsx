import React, { useDeferredValue, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, PER_PAGE, SC, SITUACOES } from "../constants/inventory.js";
import { clearFirebaseSession, fsDel, fsGetAll, fsGetDoc, fsSet, isFirebaseConfigured, setFirebaseSession, fbLogin, fbRegister, refreshAuthToken, obterInventariantePorUid, gerarLinkConviteInventariante } from "../services/firebase.js";
import { getDisplayPhotoUrl, uploadPhotos, isStorageOk, deletePhoto } from "../services/storage.js";
import { generateQRCode } from "../services/qr-service.js";
import { criarBackupManual, logAuditoria, setupRealtimeSync } from "../services/audit.js";
import { EVENTOS, gerarRelatorioExcel, gerarRelatorioPDF, notificationService, offlineManager, queueOfflineWithPhotos } from "../services/features.js";
import { garantirCampanhaAberta } from "../services/campanha.js";
import { CATEGORY_TREE, getCategoryGroup, getSubcategoryLabel } from "./categories.js";
import { compressPhotoArray, getCachedData, bumpCacheBuster, perfMonitor, setCachedData } from "../utils/performance.js";
import { loadUnidades } from "../utils/xlsx.js";
import { gerarSugestoesEspecie, gerarTodasSugestoes } from "../utils/suggestions.js";
import { buildDoacaoOrigemExtras, defaultEstadoForItem, inferEspecieFromDesc, parseBrDate, sortByDataNF } from "../utils/itemHelpers.js";
import { DoacaoOrigemFields } from "../components/DoacaoOrigemFields.jsx";
import { detectTombosDuplicados } from "../utils/tomboDup.js";
import { buildFormSnapshot, buildItemSnapshot, clearUiResume, loadUiResume, saveUiResume } from "../utils/uiResume.js";
import { canDeleteLocal, filterLocaisForSession, mergeFoundRecords, resolveUnitForItem } from "../utils/inventorySession.js";
import { normalizeFoundRecord } from "../services/inventarioLoad.js";
import { clearInventoryPresence, getTeamMemberEditingItem, loadActiveInventors, pingInventoryPresence } from "../utils/inventoryPresence.js";
import { isSemTomboItem } from "../utils/semTombo.js";
import { getFoundEntry, isItemInventariado, normalizePatrimonioId } from "../utils/patrimonioId.js";
import { rankTombosForAjuste } from "../utils/ajusteMatch.js";
import { mergeLocaisRecords } from "../services/locaisLoad.js";
import { getAppStyles, COLORS } from "../constants/theme.js";
import { SmartImg } from "../components/SmartImg.jsx";
import { ImageOverlay, Overlay } from "../components/Overlay.jsx";
import { ToastNotification } from "../components/ToastNotification.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { ItemDetailModal } from "../components/ItemDetailModal.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useUnidades } from "../hooks/useUnidades.js";
import { useLocais } from "../hooks/useLocais.js";
import { useFound } from "../hooks/useFound.js";
import { useInventario } from "../hooks/useInventario.js";
import { useCampanha } from "../hooks/useCampanha.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";
import { useFinalizacoes } from "../hooks/useFinalizacoes.js";
import { buildFinalizacaoStats, criarFinalizacao, registrarEdicaoFinalizacao, atualizarStatsFinalizacao } from "../services/finalizacoes.js";
import { CoordenadoresTab } from "./CoordenadoresTab.jsx";
import { InventariantesTab } from "./InventariantesTab.jsx";
import { ManualModal } from "../components/modals/ManualModal.jsx";
import { SemTomboModal } from "../components/modals/SemTomboModal.jsx";
import { AddLocalModal } from "../components/modals/AddLocalModal.jsx";
import { FinalizarModal } from "../components/modals/FinalizarModal.jsx";
import { LocalDetailModal } from "../components/modals/LocalDetailModal.jsx";
import { MultiItemModal } from "../components/modals/MultiItemModal.jsx";
import { AjusteLinkModal } from "../components/modals/AjusteLinkModal.jsx";
import { clearChunkReloadFlag, lazyWithRetry } from "../utils/lazyWithRetry.js";
import { createVisibilityAwarePoller, getSyncIntervals } from "../utils/mobilePerf.js";

const tabFallback = (
  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>Carregando aba…</div>
);

const LazyTombosPage = lazyWithRetry(() => import("../pages/TombosPage.jsx").then((m) => ({ default: m.TombosPage })));
const LazyDashboardPage = lazyWithRetry(() => import("../pages/DashboardPage.jsx").then((m) => ({ default: m.DashboardPage })));
const LazyInventarioPage = lazyWithRetry(() => import("../pages/InventarioPage.jsx").then((m) => ({ default: m.InventarioPage })));
const LazyBuscaPage = lazyWithRetry(() => import("../pages/BuscaPage.jsx").then((m) => ({ default: m.BuscaPage })));
const LazyItensPage = lazyWithRetry(() => import("../pages/ItensPage.jsx").then((m) => ({ default: m.ItensPage })));
const LazyNotasFiscaisPage = lazyWithRetry(() => import("../pages/NotasFiscaisPage.jsx").then((m) => ({ default: m.NotasFiscaisPage })));
const LazyFinalizadosPage = lazyWithRetry(() => import("../pages/FinalizadosPage.jsx").then((m) => ({ default: m.FinalizadosPage })));
const LazyCorrecaoNomesPage = lazyWithRetry(() => import("../pages/CorrecaoNomesPage.jsx").then((m) => ({ default: m.CorrecaoNomesPage })));

const EMPTY_SUGESTOES = { descricoes: [], especies: [], marcas: [], fornecedores: [] };

function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

function buildManualPatrimonio(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return { id: `MAN_${Date.now()}`, patrimonioLabel: null, tomboRef: null };

  const upper = raw.toUpperCase();
  if (upper === "S/T" || upper === "ST" || upper === "SEM TOMBAMENTO") {
    return { id: `ST_${Date.now()}`, patrimonioLabel: "S/T", tomboRef: null };
  }

  // Quando o usuário digita um tombamento, registramos como item manual mas
  // guardamos o tombamento sugerido em tomboRef para exibição e ligação futura.
  // O id usa prefixo MAN_ para garantir que foundMap[item.id] sempre funcione
  // (normalizePatrimonioId preserva prefixos MAN_/ST_).
  const rand = Math.random().toString(36).slice(2, 6);
  return {
    id: `MAN_${Date.now()}_${rand}`,
    patrimonioLabel: raw,
    tomboRef: raw,
  };
}

// ─── helpers to show edited description/especie ────────────────────────────
function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}
function getDisplayEspecie(item, foundEntry) {
  return foundEntry?.especieEdit || item.especie || "—";
}

function OrganizedApp({ firebaseOk, isProd }) {
  useEffect(() => {
    clearChunkReloadFlag();
  }, []);

  const [tab, setTab] = useState("inventario");
  const [busy, setBusy] = useState(false);
  const [isMob, setIsMob] = useState(window.innerWidth < 768);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [coordRegistroLink, setCoordRegistroLink] = useState("");
  const [invConviteLink, setInvConviteLink] = useState("");
  const [invConviteExp, setInvConviteExp] = useState("");
  const [gerandoInvConvite, setGerandoInvConvite] = useState(false);
  const [localDetalhe, setLocalDetalhe] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hideFound, setHideFound] = useState(true);
  const [hideIncorporados, setHideIncorporados] = useState(() => {
    try {
      const v = localStorage.getItem("inv-hide-incorporados");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const persistHideIncorporados = React.useCallback((next) => {
    setHideIncorporados(next);
    try {
      localStorage.setItem("inv-hide-incorporados", next ? "1" : "0");
    } catch {}
  }, []);
  const [tombosTab, setTombosTab] = useState("ne");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [nfSearch, setNfSearch] = useState("");
  const [nfTipo, setNfTipo] = useState("Todos");
  const [nfPage, setNfPage] = useState(1);
  const [ft, setFt] = useState(0);
  const [imgViewSrc, setImgViewSrc] = useState(null);
  const [overlayBackdropSuppressMs, setOverlayBackdropSuppressMs] = useState(0);
  const [teamOnline, setTeamOnline] = useState([]);
  const [saveConflict, setSaveConflict] = useState(null);
  const [finalizadoEdit, setFinalizadoEdit] = useState(null);

  const formRef = useRef({});
  const editingItemRef = useRef(null);
  const manualPatrimonioRef = useRef(null);
  const resumeRestoredRef = useRef(false);
  const cameraTargetRef = useRef(null);
  const multiRowsPhotosRef = useRef({});
  const multiSharedRef = useRef(null);
  const multiRowsRef = useRef(null);
  const finalizandoRef = useRef(false);

  const bumpFt = () => setFt((t) => t + 1);
  const setField = (k, v) => {
    formRef.current[k] = v;
  };
  const getField = (k) => formRef.current[k] || "";
  const revokeBlobUrls = (arr) => {
    for (const s of arr || []) {
      const v = String(s || "");
      if (v.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(v);
        } catch {}
      }
    }
  };

  const revokeRemovedBlobs = (oldArr, newArr) => {
    const keep = new Set((newArr || []).map((s) => String(s || "")));
    for (const s of oldArr || []) {
      const v = String(s || "");
      if (v.startsWith("blob:") && !keep.has(v)) {
        try {
          URL.revokeObjectURL(v);
        } catch {}
      }
    }
  };

  const showT = React.useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const onViewImage = React.useCallback((src) => {
    const s = String(src || "");
    if (!s) return;
    setImgViewSrc(s);
  }, []);

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
      if (!canDeleteLocal(l, editScopeSessionId)) {
        showT("Local de outra sessão — não pode remover");
        return;
      }
      await locais.deleteLocal(l, { updateQueueStatus });
      showT("Local removido");
    },
    [editScopeSessionId, locais.deleteLocal, showT, updateQueueStatus]
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

  useEffect(() => {
    if (!auth.logado || unidades.length === 0) return;
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
    finalizadoEdit?.fin?.id,
    inventario.unidadesAtivas.map((u) => u.id).join(","),
    unidades.length,
    found.loadFoundAndTombos,
    locais.loadLocais,
  ]);

  const saveSessionResume = React.useCallback(
    (patch = {}) => {
      const prev = loadUiResume() || {};
      const item = formRef.current.detItem;
      saveUiResume({
        modal: patch.modal ?? prev.modal ?? "detalhe",
        cameraTarget: patch.cameraTarget ?? cameraTargetRef.current ?? prev.cameraTarget ?? "detalhe",
        itemId: patch.itemId ?? item?.id ?? prev.itemId ?? "",
        itemSnapshot: patch.itemSnapshot ?? (item ? buildItemSnapshot(item) : prev.itemSnapshot ?? null),
        formSnapshot: patch.formSnapshot ?? buildFormSnapshot(formRef),
        unidadeId: patch.unidadeId ?? item?.unidadeId ?? unidadeAtiva?.id ?? prev.unidadeId ?? "",
        tab: patch.tab ?? tab,
        invSubTab: patch.invSubTab ?? inventario.invSubTab,
        pendingPhotos: patch.pendingPhotos ?? prev.pendingPhotos ?? [],
      });
    },
    [tab, inventario.invSubTab, unidadeAtiva?.id]
  );

  const persistCameraSession = React.useCallback(
    async (photos) => {
      const item = formRef.current.detItem;
      const serialized = [];
      for (const p of photos || []) {
        const s = String(p || "");
        if (!s) continue;
        if (s.startsWith("data:")) {
          serialized.push(s);
          continue;
        }
        if (s.startsWith("blob:")) {
          try {
            const blob = await fetch(s).then((r) => r.blob());
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = () => reject(new Error("read fail"));
              reader.readAsDataURL(blob);
            });
            if (dataUrl) serialized.push(dataUrl);
          } catch {}
        }
      }
      saveSessionResume({
        modal: serialized.length ? "detalhe" : "camera",
        cameraTarget: cameraTargetRef.current || "detalhe",
        pendingPhotos: serialized,
        itemSnapshot: item ? buildItemSnapshot(item) : undefined,
      });
    },
    [saveSessionResume]
  );

  useEffect(() => {
    const h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    if (!modal) return;
    const scrollY = window.scrollY || 0;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [modal]);

  const activeUnitIds = React.useMemo(
    () => inventario.unidadesAtivas.map((u) => u.id).filter(Boolean),
    [inventario.unidadesAtivas]
  );

  useEffect(() => {
    if (!auth.logado?.uid || inventario.unidadesAtivas.length === 0 || inventario.invSubTab !== "andamento") {
      setTeamOnline([]);
      return;
    }

    const unitIds = activeUnitIds;
    const ping = () => {
      const item = editingItemRef.current;
      pingInventoryPresence({
        uid: auth.logado.uid,
        nome: auth.logado.nome,
        email: auth.logado.email,
        unidadeIds: unitIds,
        itemEmEdicao: item?.id || null,
        itemDescricao: item ? String(item.descricao || item.especie || item.id || "").trim() : "",
      }).catch(() => {});
    };

    const stopPing = createVisibilityAwarePoller(ping, {
      activeMs: 45000,
      hiddenMs: 120000,
      runImmediately: true,
    });
    const stopTeam = createVisibilityAwarePoller(
      async () => {
        try {
          const others = await loadActiveInventors(unitIds, { excludeUid: auth.logado.uid });
          setTeamOnline(others);
        } catch {}
      },
      { activeMs: 45000, hiddenMs: 180000, runImmediately: true }
    );

    return () => {
      stopPing();
      stopTeam();
      clearInventoryPresence(auth.logado.uid).catch(() => {});
    };
  }, [auth.logado?.uid, auth.logado?.nome, auth.logado?.email, activeUnitIds.join(","), inventario.invSubTab]);

  // Refs para que o poller leia sempre o estado mais recente sem reiniciar
  // toda vez que items/unidades mudam (do contrário cada item adicionado
  // restartaria o sync, gerando uma cascata de network requests).
  const syncContextRef = useRef({
    unidadesAtivas: inventario.unidadesAtivas,
    allItens: inventario.allItens,
    unidades,
    updateQueueStatus,
  });
  useEffect(() => {
    syncContextRef.current = {
      unidadesAtivas: inventario.unidadesAtivas,
      allItens: inventario.allItens,
      unidades,
      updateQueueStatus,
    };
  });

  useEffect(() => {
    if (!auth.logado?.uid) return;
    const paused = inventario.invSubTab === "inventariar" && inventario.unidadesAtivas.length > 0;
    if (!paused) syncContextRef.current.updateQueueStatus?.();

    const onInventarioChange = async (docs) => {
      const ctx = syncContextRef.current;
      const incoming = docs.map((d) => normalizeFoundRecord({ ...d, patrimonioId: d.patrimonioId || d._id }));
      const prev = found.foundRef.current || [];
      const scopeItems =
        ctx.unidadesAtivas.length > 0
          ? ctx.allItens
          : ctx.unidades.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome })));
      const nextFound = mergeFoundRecords(prev, incoming, {
        keepItemIds: scopeItems.map((i) => i.id),
        itemUnits: new Map(scopeItems.map((i) => [i.id, { unidadeId: i.unidadeId, unidadeNome: i.unidadeNome }])),
      });
      let same = prev.length === nextFound.length;
      if (same) {
        const prevMap = new Map(prev.map((p) => [p.patrimonioId || p._id, `${p.ultimaAtualizacao || ""}|${(p.fotoUrls || []).length}`]));
        same = prevMap.size === nextFound.length;
        if (same) {
          for (const n of nextFound) {
            const id = n.patrimonioId || n._id;
            const sig = `${n.ultimaAtualizacao || ""}|${(n.fotoUrls || []).length}`;
            if (prevMap.get(id) !== sig) {
              same = false;
              break;
            }
          }
        }
      }
      if (!same) {
        found.foundRef.current = nextFound;
        found.setFound(nextFound);
        await setCachedData("inventario", nextFound);
      }
    };

    const onLocaisChange = paused
      ? null
      : async (docs) => {
        const incoming = docs.map((d) => ({ ...d, id: d._id || d.id }));
        const prev = locais.locaisRef.current || [];
        const nextLocais = mergeLocaisRecords(prev, incoming);
        let same = prev.length === nextLocais.length;
        if (same) {
          const prevMap = new Map(prev.map((p) => [p.id || p._id, String(p.nome || "")]));
          for (const n of nextLocais) {
            const id = n.id || n._id;
            if (prevMap.get(id) !== String(n.nome || "")) {
              same = false;
              break;
            }
          }
        }
        if (!same) {
          locais.setLocais(nextLocais);
          await setCachedData("locais", nextLocais);
        }
      };

    const syncMs = getSyncIntervals({ paused, isMobile: isMob });
    const unsub = setupRealtimeSync(
      activeUnitIds.length ? activeUnitIds : unidadeAtiva?.id,
      onInventarioChange,
      onLocaisChange,
      null,
      syncMs
    );

    return () => {
      unsub?.();
    };
  }, [
    auth.logado?.uid,
    activeUnitIds.join(","),
    unidadeAtiva?.id,
    inventario.invSubTab,
    isMob,
    found.setFound,
    found.foundRef,
    locais.setLocais,
    locais.locaisRef,
  ]);

  const renderOfflineStatus = () => {
    const retry = async (e) => {
      e?.stopPropagation?.();
      await offlineManager.retrySync();
      updateQueueStatus();
      showT("Sincronização iniciada");
    };

    if (queueStatus.isOnline && queueStatus.pending === 0 && queueStatus.failed === 0) {
      return <span style={{ fontSize: 11, color: "#C6E0FF", fontWeight: 700 }}>● Online</span>;
    }

    const btnStyle = {
      marginLeft: 8,
      background: "rgba(255,255,255,.2)",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
    };

    if (!queueStatus.isOnline) {
      return (
        <span style={{ fontSize: 11, color: "#FFF8E6", fontWeight: 700 }}>
          Offline · {queueStatus.pending} pendente{queueStatus.pending !== 1 ? "s" : ""}
          {queueStatus.photoPending ? ` · ${queueStatus.photoPending} c/ fotos` : ""}
        </span>
      );
    }

    return (
      <span style={{ fontSize: 11, color: "#FFF8E6", fontWeight: 700, display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        {queueStatus.isSyncing ? "Sincronizando" : "Fila"} · {queueStatus.pending} pendente{queueStatus.pending !== 1 ? "s" : ""}
        {queueStatus.photoPending ? ` · ${queueStatus.photoPending} c/ fotos` : ""}
        {queueStatus.failed ? ` · ${queueStatus.failed} falha(s)` : ""}
        {(queueStatus.pending > 0 || queueStatus.failed > 0) && !queueStatus.isSyncing ? (
          <button type="button" onClick={retry} style={btnStyle}>
            Tentar novamente
          </button>
        ) : null}
      </span>
    );
  };

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

  const aplicarCorrecaoNomes = React.useCallback(
    async ({ targetIds, descricao, especie }) => {
      if (!assertPodeEditar()) return;
      const ids = (targetIds || []).filter(Boolean);
      if (!ids.length) return;
      setBusy(true);
      try {
        const now = new Date().toISOString();
        const desc = String(descricao || "").trim();
        const esp = String(especie || "").trim();
        if (!desc) throw new Error("Nome vazio");

        for (const id of ids) {
          const item = todosItens.find((i) => i.id === id);
          if (!item) continue;
          const f = found.foundMap[id];
          const antes = {
            descricao: f?.descricaoEdit || item.descricao,
            especie: f?.especieEdit || item.especie,
          };
          await fsSet("manuais", id, { ...item, descricao: desc, especie: esp, unidadeId: item.unidadeId });
          if (f) {
            await fsSet("inventario", id, {
              ...f,
              patrimonioId: id,
              descricaoEdit: desc,
              especieEdit: esp,
              ultimaAtualizacao: now,
              usuario: auth.logado?.nome || "",
              email: auth.logado?.email || "",
            });
          }
          await logAuditoria("rename", "manuais", id, antes, { descricao: desc, especie: esp });
        }

        const idSet = new Set(ids);
        const patchItem = (it) => (idSet.has(it.id) ? { ...it, descricao: desc, especie: esp } : it);
        setUnidades((prev) => prev.map((u) => ({ ...u, itens: u.itens.map(patchItem) })));
        inventario.setUnidadesAtivas((prev) => prev.map((u) => ({ ...u, itens: u.itens.map(patchItem) })));

        const nextFound = (found.foundRef.current || []).map((f) => {
          const pid = f.patrimonioId || f._id;
          if (!idSet.has(pid)) return f;
          return { ...f, descricaoEdit: desc, especieEdit: esp, ultimaAtualizacao: now };
        });
        found.syncFoundRef(nextFound);
        await setCachedData("inventario", nextFound);
        bumpCacheBuster();
        showT(`Nomes padronizados: ${ids.length} item(ns)`);
      } catch (e) {
        showT("Erro ao corrigir nomes: " + (e?.message || e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [assertPodeEditar, todosItens, found, auth.logado, inventario, setUnidades, showT]
  );

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
  const totalPages = Math.ceil(sortedFiltered.length / PER_PAGE);
  const paged = sortedFiltered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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
    { id: "tombos", l: "Tombos" },
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

  const releaseEditingPresence = React.useCallback(() => {
    editingItemRef.current = null;
    if (!auth.logado?.uid || inventario.unidadesAtivas.length === 0) return;
    pingInventoryPresence({
      uid: auth.logado.uid,
      nome: auth.logado.nome,
      email: auth.logado.email,
      unidadeIds: activeUnitIds,
      itemEmEdicao: null,
      itemDescricao: "",
    }).catch(() => {});
  }, [auth.logado?.uid, auth.logado?.nome, auth.logado?.email, activeUnitIds, inventario.unidadesAtivas.length]);

  const closeDetModal = React.useCallback(() => {
    revokeBlobUrls(formRef.current.detNewBase64 || []);
    clearUiResume();
    releaseEditingPresence();
    setModal(null);
  }, [releaseEditingPresence]);

  const applyServerEntryToDetForm = React.useCallback(
    (serverEntry) => {
      const item = formRef.current.detItem;
      if (!item || !serverEntry) return;
      formRef.current.detEstado = serverEntry.estado || formRef.current.detEstado;
      formRef.current.detSituacao = serverEntry.situacao || formRef.current.detSituacao;
      formRef.current.detLocal = serverEntry.localId || formRef.current.detLocal;
      formRef.current.detObs = serverEntry.obs || "";
      formRef.current.detMarca = serverEntry.marca || item.marca || "";
      formRef.current.detOrigem = serverEntry.origem || formRef.current.detOrigem;
      formRef.current.detExistingUrls = serverEntry.fotoUrls || [];
      formRef.current.detNewBase64 = [];
      formRef.current.detDescricao = serverEntry.descricaoEdit || item.descricao || "";
      formRef.current.detEspecie = serverEntry.especieEdit || item.especie || "";
      formRef.current.detPermutaDesc = serverEntry.permutaDesc || "";
      formRef.current.detPermutaMarca = serverEntry.permutaMarca || "";
      formRef.current.detPermutaEstado = serverEntry.permutaEstado || "Bom";
      formRef.current.detTomboRef = serverEntry.tomboReferencia || "";
      formRef.current.detServerTs = serverEntry.ultimaAtualizacao || null;
      formRef.current.detServerEmail = serverEntry.email || "";
      formRef.current.detForceWrite = false;
      const nextFound = (found.foundRef.current || []).slice();
      const idx = nextFound.findIndex((f) => (f.patrimonioId || f._id) === item.id);
      const merged = { ...serverEntry, _id: item.id, patrimonioId: item.id };
      if (idx >= 0) nextFound[idx] = merged;
      else nextFound.push(merged);
      found.setFound(nextFound);
      bumpFt();
    },
    [found]
  );

  const openDetModal = (item, forceLocalId) => {
    const f = getFoundEntry(item.id, found.foundMap);
    const estadoDefault = f?.estado || defaultEstadoForItem(item);
    editingItemRef.current = item;
    if (auth.logado?.uid && inventario.unidadesAtivas.length > 0) {
      pingInventoryPresence({
        uid: auth.logado.uid,
        nome: auth.logado.nome,
        email: auth.logado.email,
        unidadeIds: activeUnitIds,
        itemEmEdicao: item.id,
        itemDescricao: getDisplayDesc(item, f),
      }).catch(() => {});
    }
    formRef.current = {
      detItem: item,
      detEstado: estadoDefault,
      detSituacao: f?.situacao || "Em uso",
      detLocal: typeof forceLocalId === "string" ? forceLocalId : f?.localId || inventario.activeLocalId || "",
      detObs: f?.obs || "",
      detMarca: f?.marca || item.marca || "",
      detOrigem: f?.origem || (item.isManual ? "Próprio" : item.tipoEntrada || "Próprio"),
      detOrigemLocked: !item.isManual,
      detExistingUrls: f?.fotoUrls || [],
      detNewBase64: [],
      detDescricao: f?.descricaoEdit || item.descricao || "",
      detEspecie: f?.especieEdit || item.especie || "",
      detPermutaDesc: f?.permutaDesc || "",
      detPermutaMarca: f?.permutaMarca || "",
      detPermutaEstado: f?.permutaEstado || "Bom",
      detTomboRef: f?.tomboReferencia || "",
      detImei: f?.imei || item.imei || "",
      detPlaquetaAusente: !!f?.plaquetaAusente,
      detServerTs: f?.ultimaAtualizacao || null,
      detServerEmail: f?.email || "",
      detForceWrite: false,
    };
    bumpFt();
    resumeRestoredRef.current = true;
    saveSessionResume({
      modal: "detalhe",
      cameraTarget: "detalhe",
      pendingPhotos: [],
      itemSnapshot: buildItemSnapshot(item),
    });
    setModal("detalhe");
  };

  const openNextPending = React.useCallback(() => {
    const myUid = auth.logado?.uid || "";
    const next = sortedFiltered.find((i) => {
      if (isItemInventariado(i.id, found.foundSet)) return false;
      return !getTeamMemberEditingItem(teamOnline, i.id, myUid);
    });
    if (!next) {
      showT("Nenhum item pendente nos filtros atuais (itens em uso por colegas são ignorados)");
      return;
    }
    openDetModal(next);
  }, [sortedFiltered, found.foundSet, showT, teamOnline, auth.logado?.uid]);

  const openCamera = (target) => {
    cameraTargetRef.current = target;
    resumeRestoredRef.current = true;
    saveSessionResume({
      modal: "camera",
      cameraTarget: target,
      pendingPhotos: [],
    });
    setCameraTarget(target);
    setModal("camera");
  };

  const ensureDetFormFromResume = (resume) => {
    if (formRef.current.detItem?.id) return;
    const snap = resume?.itemSnapshot;
    if (!snap?.id) return;
    const fs = resume?.formSnapshot || {};
    const f = getFoundEntry(snap.id, found.foundMap);
    formRef.current = {
      detItem: snap,
      detEstado: fs.detEstado || f?.estado || defaultEstadoForItem(snap),
      detSituacao: fs.detSituacao || f?.situacao || "Em uso",
      detLocal: fs.detLocal || f?.localId || inventario.activeLocalId || "",
      detObs: fs.detObs || f?.obs || "",
      detMarca: fs.detMarca || f?.marca || snap.marca || "",
      detOrigem: fs.detOrigem || f?.origem || (snap.isManual ? "Próprio" : snap.tipoEntrada || "Próprio"),
      detOrigemLocked: fs.detOrigemLocked ?? !snap.isManual,
      detExistingUrls: fs.detExistingUrls?.length ? fs.detExistingUrls : f?.fotoUrls || [],
      detNewBase64: formRef.current.detNewBase64 || [],
      detDescricao: fs.detDescricao || f?.descricaoEdit || snap.descricao || "",
      detEspecie: fs.detEspecie || f?.especieEdit || snap.especie || "",
      detPermutaDesc: fs.detPermutaDesc || f?.permutaDesc || "",
      detPermutaMarca: fs.detPermutaMarca || f?.permutaMarca || "",
      detPermutaEstado: fs.detPermutaEstado || f?.permutaEstado || "Bom",
      detTomboRef: fs.detTomboRef || f?.tomboReferencia || "",
      detImei: fs.detImei || f?.imei || "",
      detPlaquetaAusente: fs.detPlaquetaAusente ?? !!f?.plaquetaAusente,
      detServerTs: f?.ultimaAtualizacao || null,
      detServerEmail: f?.email || "",
      detForceWrite: false,
    };
    if (formRef.current.detItem) editingItemRef.current = formRef.current.detItem;
  };

  const onCameraCapture = async (photoArray) => {
    const resume = loadUiResume();
    const target = cameraTargetRef.current || resume?.cameraTarget || "detalhe";
    ensureDetFormFromResume(resume);
    const incoming = Array.isArray(photoArray) ? photoArray : [];

    if (target.startsWith("multi-row-")) {
      const idx = target.slice("multi-row-".length);
      const prev = multiRowsPhotosRef.current[idx] || [];
      revokeRemovedBlobs(prev, incoming);
      multiRowsPhotosRef.current[idx] = incoming;
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("multi");
      bumpFt();
      return;
    }

    if (target === "manual") {
      revokeRemovedBlobs(formRef.current.manPhotos, incoming);
      formRef.current.manPhotos = incoming;
    } else if (target === "semTombo") {
      revokeRemovedBlobs(formRef.current.stPhotos, incoming);
      formRef.current.stPhotos = incoming;
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("semTombo");
      bumpFt();
      return;
    } else {
      revokeRemovedBlobs(formRef.current.detNewBase64, incoming);
      formRef.current.detNewBase64 = incoming;
    }

    cameraTargetRef.current = null;
    setCameraTarget(null);
    setOverlayBackdropSuppressMs(1200);
    resumeRestoredRef.current = true;
    setModal(target === "manual" ? "manual" : "detalhe");
    bumpFt();

    const photos = target === "manual" ? formRef.current.manPhotos : formRef.current.detNewBase64;
    await persistCameraSession(photos);
    bumpFt();
  };

  const closeCameraModal = () => {
    const target = cameraTargetRef.current || cameraTarget;
    cameraTargetRef.current = null;
    setCameraTarget(null);
    setOverlayBackdropSuppressMs(1200);
    ensureDetFormFromResume(loadUiResume());
    setModal(target === "manual" ? "manual" : target === "semTombo" ? "semTombo" : formRef.current.detItem ? "detalhe" : null);
    bumpFt();
    if (!formRef.current.detItem) clearUiResume();
  };

  const applyUiResume = React.useCallback(
    (resume) => {
      if (!resume?.itemId && !resume?.itemSnapshot?.id) return false;

      let item = resume.itemSnapshot?.id ? resume.itemSnapshot : null;
      if (!item && unidades.length > 0) {
        for (const u of unidades) {
          const hit = u.itens.find((i) => i.id === resume.itemId || i.patrimonioLabel === resume.itemId);
          if (hit) {
            item = { ...hit, unidadeId: u.id, unidadeNome: u.nome };
            break;
          }
        }
      }
      if (!item?.id) return false;

      if (resume.tab) setTab(resume.tab);
      if (resume.invSubTab) inventario.setInvSubTab(resume.invSubTab);

      const fs = resume.formSnapshot || {};
      const f = found.foundMap[item.id];
      const pending = Array.isArray(resume.pendingPhotos) ? resume.pendingPhotos : [];
      const existingNew = formRef.current.detNewBase64 || [];
      const restoredPhotos =
        pending.length > 0
          ? pending
          : existingNew.length > 0
            ? existingNew
            : [];

      formRef.current = {
        detItem: item,
        detEstado: fs.detEstado || f?.estado || defaultEstadoForItem(item),
        detSituacao: fs.detSituacao || f?.situacao || "Em uso",
        detLocal: fs.detLocal || f?.localId || inventario.activeLocalId || "",
        detObs: fs.detObs || f?.obs || "",
        detMarca: fs.detMarca || f?.marca || item.marca || "",
        detOrigem: fs.detOrigem || f?.origem || (item.isManual ? "Próprio" : item.tipoEntrada || "Próprio"),
        detOrigemLocked: fs.detOrigemLocked ?? !item.isManual,
        detExistingUrls: fs.detExistingUrls?.length ? fs.detExistingUrls : f?.fotoUrls || [],
        detNewBase64: resume.cameraTarget === "manual" ? [] : restoredPhotos,
        detDescricao: fs.detDescricao || f?.descricaoEdit || item.descricao || "",
        detEspecie: fs.detEspecie || f?.especieEdit || item.especie || "",
        detPermutaDesc: fs.detPermutaDesc || f?.permutaDesc || "",
        detPermutaMarca: fs.detPermutaMarca || f?.permutaMarca || "",
        detPermutaEstado: fs.detPermutaEstado || f?.permutaEstado || "Bom",
        detTomboRef: fs.detTomboRef || f?.tomboReferencia || "",
        detImei: fs.detImei || f?.imei || "",
        detPlaquetaAusente: fs.detPlaquetaAusente ?? !!f?.plaquetaAusente,
        detServerTs: f?.ultimaAtualizacao || null,
        detServerEmail: f?.email || "",
        detForceWrite: false,
      };
      editingItemRef.current = item;

      if (pending.length && resume.cameraTarget === "manual") {
        formRef.current.manPhotos = pending;
      }

      const reopenCamera = resume.modal === "camera" && !pending.length;
      if (reopenCamera) {
        cameraTargetRef.current = resume.cameraTarget || "detalhe";
        setCameraTarget(resume.cameraTarget || "detalhe");
        setModal("camera");
      } else {
        setModal(resume.cameraTarget === "manual" ? "manual" : "detalhe");
      }
      bumpFt();
      return true;
    },
    [unidades, found.foundMap, inventario.setInvSubTab]
  );

  const tryRestoreUi = React.useCallback(() => {
    if (!auth.logado || resumeRestoredRef.current) return;
    const resume = loadUiResume();
    if (!resume?.itemId && !resume?.itemSnapshot?.id) return;
    if (applyUiResume(resume)) resumeRestoredRef.current = true;
  }, [auth.logado, applyUiResume]);

  React.useLayoutEffect(() => {
    tryRestoreUi();
  }, [tryRestoreUi]);

  useEffect(() => {
    const onPageShow = () => tryRestoreUi();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [tryRestoreUi]);

  useEffect(() => {
    const persistOnHide = () => {
      if (modal !== "camera" && modal !== "detalhe" && modal !== "manual") return;
      saveSessionResume({
        modal,
        cameraTarget: cameraTargetRef.current || "detalhe",
      });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") persistOnHide();
    };
    window.addEventListener("pagehide", persistOnHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", persistOnHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [modal, saveSessionResume]);

  useEffect(() => {
    if (!auth.logado?.uid || resumeRestoredRef.current) return;
    tryRestoreUi();
  }, [auth.logado?.uid, unidades, found.foundMap, tryRestoreUi]);

  // Busca um tombo digitado em TODAS as unidades da base (id ou etiqueta),
  // para avisar quando o item manual que está sendo criado já existe na planilha.
  const lookupTombo = React.useCallback(
    (raw) => {
      const alvo = normalizePatrimonioId(raw);
      if (!alvo || /^(ST_|MAN_)/i.test(alvo)) return null;
      for (const u of unidades) {
        for (const i of u.itens) {
          if (
            normalizePatrimonioId(i.id) === alvo ||
            (i.patrimonioLabel && normalizePatrimonioId(i.patrimonioLabel) === alvo)
          ) {
            const f = getFoundEntry(i.id, found.foundMap);
            return {
              item: { ...i, unidadeId: u.id, unidadeNome: u.nome },
              inventariado: !!f,
              foundBy: f?.usuario || f?.user || "",
              outraUnidade: unidadeAtiva ? u.id !== unidadeAtiva.id : false,
            };
          }
        }
      }
      return null;
    },
    [unidades, found.foundMap, unidadeAtiva]
  );

  // Quando um finalizado está aberto para edição, itens novos precisam entrar
  // no snapshot finalizadoEdit.units (senão só aparecem ao reabrir) e as
  // estatísticas do registro de finalização precisam ser recalculadas.
  const appendItemsToFinalizadoScope = (unitId, items) => {
    if (!finalizadoEdit?.fin || !items?.length) return;
    const units = finalizadoEdit.units.map((u) =>
      u.id === unitId ? { ...u, itens: [...u.itens, ...items] } : u
    );
    setFinalizadoEdit({ ...finalizadoEdit, units });
    if (finalizadoEdit.fin.id && !finalizadoEdit.fin.legacy) {
      const nextFoundSet = new Set([...found.foundSet, ...items.map((i) => i.id)]);
      atualizarStatsFinalizacao(finalizadoEdit.fin.id, buildFinalizacaoStats(units, nextFoundSet))
        .then(() => finalizacoesState.refresh?.())
        .catch(() => {});
    }
  };

  const addManual = async () => {
    if (!assertPodeEditar()) return;
    const desc = getField("manDesc");
    if (!desc.trim()) {
      showT("Descrição obrigatória");
      return;
    }
    if (!unidadeAtiva) {
      showT("Selecione uma unidade");
      return;
    }
    const qty = Math.max(1, Math.min(50, Math.floor(Number(formRef.current.manQtd || 1) || 1)));
    const sharePhotos = formRef.current.manSharePhotos !== false;

    const manualPatrimonioRaw = String(getField("manPatrimonio") || "").trim();
    const manualPatrimonio = buildManualPatrimonio(manualPatrimonioRaw);

    if (qty > 1 && !sharePhotos) {
      showT("Para fotos diferentes, cadastre um item por vez");
      return;
    }

    if (qty > 1 && manualPatrimonioRaw && manualPatrimonio.patrimonioLabel !== "S/T") {
      showT("Para patrimônio informado, use quantidade 1");
      return;
    }

    const manImei = String(getField("manImei") || "").trim();
    if (manImei && qty > 1) {
      showT("IMEI é único por aparelho — cadastre um item por vez");
      return;
    }

    // Tombo digitado já existe em alguma unidade da base? Avisa antes de duplicar.
    if (manualPatrimonioRaw && manualPatrimonio.patrimonioLabel !== "S/T") {
      const hit = lookupTombo(manualPatrimonioRaw);
      if (hit) {
        const unidadeHit = String(hit.item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "");
        const msg = hit.inventariado
          ? `O tombo ${manualPatrimonioRaw} JÁ FOI INVENTARIADO (${unidadeHit}${hit.foundBy ? `, por ${hit.foundBy}` : ""}).\n\nCriar um item manual duplicado mesmo assim?`
          : `O tombo ${manualPatrimonioRaw} já existe na planilha da unidade "${unidadeHit}".\n\nO recomendado é abrir o item da planilha (botão no aviso amarelo). Criar um item manual mesmo assim?`;
        if (!window.confirm(msg)) return;
      }
    }

    const baseNow = Date.now();
    const existingIds = new Set((unidadeAtiva?.itens || []).map((i) => i.id));

    const makeId = (kind, i) => {
      const rand = Math.random().toString(36).slice(2, 7);
      return `${kind}_${baseNow}_${rand}_${i + 1}`;
    };

    const kind = manualPatrimonio.patrimonioLabel === "S/T" ? "ST" : manualPatrimonioRaw ? "MAN" : "MAN";

    const ids = [];
    if (qty === 1) {
      const id = manualPatrimonio.id;
      // IDs MAN_ são sempre únicos (baseados em Date.now + rand), sem risco de duplicata
      if (!id.startsWith("MAN_") && !id.startsWith("ST_") && existingIds.has(id)) {
        showT("Já existe um item com esse patrimônio nesta unidade");
        return;
      }
      ids.push(id);
    } else {
      for (let i = 0; i < qty; i++) {
        let candidate = makeId(kind, i);
        while (existingIds.has(candidate) || ids.includes(candidate)) candidate = makeId(kind, i);
        ids.push(candidate);
      }
    }

    const baseItem = {
      patrimonioLabel: manualPatrimonio.patrimonioLabel,
      ...(manualPatrimonio.tomboRef ? { tomboRef: manualPatrimonio.tomboRef } : {}),
      data: new Date().toLocaleDateString("pt-BR"),
      especie: getField("manEspecie") || inferEspecieFromDesc(desc, sugestoes?.especies),
      descricao: desc.trim(),
      marca: getField("manMarca"),
      fornecedor: getField("manFornecedor"),
      empenho: "",
      nf: "",
      dataNF: "",
      valor: parseFloat(getField("manValor")) || 0,
      valorAtual: 0,
      isManual: true,
      ...(manImei ? { imei: manImei } : {}),
    };

    const newItems = ids.map((id) => ({ ...baseItem, id }));
    const manLocalId = getField("manLocal") || sessionLocais[0]?.id || "";
    const manEstado = getField("manEstado") || "Bom";
    const manSituacao = getField("manSituacao") || "Em uso";
    const manOrigem = getField("manOrigem") || "Próprio";
    const manMarca = getField("manMarca") || "";

    const doacaoExtras = {
      ...buildDoacaoOrigemExtras(getField, "man"),
      ...(manImei ? { imei: manImei } : {}),
    };

    const buildManualInvEntry = (it, urls = []) => {
      const now = new Date();
      return {
        patrimonioId: it.id,
        unidadeId: unidadeAtiva?.id || "",
        unidadeNome: unidadeAtiva?.nome || "",
        estado: manEstado,
        situacao: manSituacao,
        localId: manLocalId,
        obs: desc.trim(),
        marca: manMarca,
        origem: manOrigem,
        ...doacaoExtras,
        fotoUrls: urls,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: auth.logado?.nome || "",
        email: auth.logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        user: auth.logado?.nome || "",
        isManual: true,
      };
    };

    if (!navigator.onLine) {
      const steps = [];
      for (const it of newItems) {
        steps.push({ collection: "manuais", docId: it.id, content: { ...it, unidadeId: unidadeAtiva?.id } });
        steps.push({ collection: "inventario", docId: it.id, content: buildManualInvEntry(it), usePhotos: Boolean(formRef.current.manPhotos?.length) });
      }
      await queueOfflineWithPhotos({
        type: "batch",
        data: { steps, uploadPrefix: sharePhotos && qty > 1 ? `manual/${ids[0]}` : ids[0] },
        photos: formRef.current.manPhotos || [],
      });
      updateQueueStatus();
      const novaAtiva = { ...unidadeAtiva, itens: [...unidadeAtiva.itens, ...newItems] };
      inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      appendItemsToFinalizadoScope(novaAtiva.id, newItems);
      for (const it of newItems) {
        await found.markFound({
          itemId: it.id,
          estado: manEstado,
          situacao: manSituacao,
          localId: manLocalId,
          obs: desc.trim(),
          marca: manMarca,
          origem: manOrigem,
          extras: doacaoExtras,
          fotoUrls: [],
          unidadeAtiva,
          logado: auth.logado,
          localOnly: true,
          isManual: true,
        });
      }
      setModal(null);
      showT(qty > 1 ? `${qty} itens na fila (offline)` : "Na fila (offline)");
      notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Item enfileirado offline", type: "info" });
      return;
    }

    let fotoUrls = [];
    if (formRef.current.manPhotos?.length && isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.manPhotos);
        const uploadPrefix = sharePhotos && qty > 1 ? `manual/${ids[0]}` : ids[0];
        fotoUrls = await uploadPhotos(compressed, uploadPrefix);
      } catch {} finally {
        setBusy(false);
      }
    }

    for (const it of newItems) {
      await fsSet("manuais", it.id, { ...it, unidadeId: unidadeAtiva?.id });
    }

    const novaAtiva = { ...unidadeAtiva, itens: [...unidadeAtiva.itens, ...newItems] };
    inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    appendItemsToFinalizadoScope(novaAtiva.id, newItems);

    for (const it of newItems) {
      const createdResult = await found.markFound({
        itemId: it.id,
        estado: getField("manEstado") || "Bom",
        situacao: getField("manSituacao") || "Em uso",
        localId: getField("manLocal") || sessionLocais[0]?.id || "",
        obs: desc.trim(),
        marca: getField("manMarca"),
        origem: getField("manOrigem") || "Próprio",
        extras: doacaoExtras,
        fotoUrls,
        unidadeAtiva,
        logado: auth.logado,
        isManual: true,
      });
      await logAuditoria("create", "manuais", it.id, null, { ...it, unidadeId: unidadeAtiva?.id, fotoUrls, inventario: createdResult?.entry });
    }

    setModal(null);
    showT(qty > 1 ? `Itens adicionados: ${qty}` : "Salvo!");
    notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Item manual salvo", type: "success" });
  };

  const addSemTomboItem = async () => {
    if (!assertPodeEditar()) return;
    const desc = String(getField("stDesc") || "").trim();
    if (!desc) {
      showT("Informe o nome do item");
      return;
    }
    const localId = String(getField("stLocal") || "").trim();
    if (!localId) {
      showT("Selecione um local da sessão");
      return;
    }
    const unitId = String(getField("stUnidadeId") || unidadeAtiva?.id || "").trim();
    const unit = editScopeUnits.find((u) => u.id === unitId) || unidadeAtiva;
    if (!unit) {
      showT("Unidade não encontrada");
      return;
    }
    if (!formRef.current.stPhotos?.length) {
      showT("Tire pelo menos uma foto do item");
      return;
    }

    const id = `ST_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      id,
      patrimonioLabel: "S/T",
      data: new Date().toLocaleDateString("pt-BR"),
      especie: inferEspecieFromDesc(desc, sugestoes?.especies),
      descricao: desc,
      marca: "",
      fornecedor: "",
      empenho: "",
      nf: "",
      dataNF: "",
      valor: 0,
      valorAtual: 0,
      isManual: true,
      semTombo: true,
      identificadoPorFoto: true,
    };

    const stOrigem = getField("stOrigem") || "Próprio";
    const stImei = String(getField("stImei") || "").trim();
    const stExtras = {
      semTombo: true,
      identificadoPorFoto: true,
      descricaoEdit: desc,
      tomboReferencia: String(getField("stTomboRef") || "").trim(),
      marca: String(getField("stMarca") || "").trim(),
      ...(stImei ? { imei: stImei } : {}),
      ...buildDoacaoOrigemExtras(getField, "st"),
    };
    const stEstado = getField("stEstado") || "Bom";
    const stObs = String(getField("stObs") || "").trim();

    if (!navigator.onLine) {
      const now = new Date();
      const invEntry = {
        patrimonioId: id,
        unidadeId: unit.id,
        unidadeNome: unit.nome,
        estado: stEstado,
        situacao: "Em uso",
        localId,
        obs: stObs,
        marca: "",
        origem: stOrigem,
        fotoUrls: [],
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: auth.logado?.nome || "",
        email: auth.logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        user: auth.logado?.nome || "",
        ...stExtras,
      };
      await queueOfflineWithPhotos({
        type: "batch",
        data: {
          steps: [
            { collection: "manuais", docId: id, content: { ...item, unidadeId: unit.id } },
            { collection: "inventario", docId: id, content: invEntry, usePhotos: true },
          ],
          uploadPrefix: id,
        },
        photos: formRef.current.stPhotos || [],
      });
      updateQueueStatus();
      const novaAtiva = { ...unit, itens: [...unit.itens, item] };
      inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      appendItemsToFinalizadoScope(novaAtiva.id, [item]);
      await found.markFound({
        itemId: id,
        estado: stEstado,
        situacao: "Em uso",
        localId,
        obs: stObs,
        marca: stExtras.marca || "",
        origem: stOrigem,
        fotoUrls: [],
        extras: stExtras,
        unidadeAtiva: unit,
        itemUnit: unit,
        logado: auth.logado,
        localOnly: true,
      });
      revokeBlobUrls(formRef.current.stPhotos || []);
      setModal(null);
      showT("Na fila (offline)");
      return;
    }

    let fotoUrls = [];
    if (isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.stPhotos);
        fotoUrls = await uploadPhotos(compressed, id);
      } catch {
        showT("Erro ao enviar fotos");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    await fsSet("manuais", id, { ...item, unidadeId: unit.id });
    const novaAtiva = { ...unit, itens: [...unit.itens, item] };
    inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    appendItemsToFinalizadoScope(novaAtiva.id, [item]);

    await found.markFound({
      itemId: id,
      estado: stEstado,
      situacao: "Em uso",
      localId,
      obs: stObs,
      marca: stExtras.marca || "",
      origem: stOrigem,
      fotoUrls,
      extras: stExtras,
      unidadeAtiva: unit,
      itemUnit: unit,
      logado: auth.logado,
    });

    revokeBlobUrls(formRef.current.stPhotos || []);
    setModal(null);
    showT("Salvo!");
  };

  const addMultiItems = async ({ shared, rows }) => {
    if (!assertPodeEditar()) return;
    const unidadeAtiva = inventario.unidadesAtivas[0]; // Simplificação para pegar a primeira
    if (!unidadeAtiva) {
      showT("Selecione uma unidade");
      return;
    }
    const desc = String(shared.descricao || "").trim();
    if (!desc) {
      showT("Descrição compartilhada obrigatória");
      return;
    }

    const baseNow = Date.now();
    const existingIds = new Set((unidadeAtiva?.itens || []).map((i) => i.id));
    let saved = 0;

    const multiOrigem = shared.origem || "Próprio";
    const multiDoacaoExtras = (() => {
      if (multiOrigem !== "Doação") return {};
      if ((shared.multiDoacaoModo || "uf") === "texto") {
        const texto = String(shared.multiDoacaoTexto || "").trim();
        return texto ? { doacaoOrigem: texto, doacaoOrigemTipo: "texto" } : {};
      }
      const uf = String(shared.multiDoacaoUf || "MA").trim().toUpperCase();
      return uf ? { doacaoOrigem: uf, doacaoOrigemTipo: "uf" } : {};
    })();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowPhotos = multiRowsPhotosRef.current[String(idx)] || [];
      const tombamento = String(row.tombamento || "").trim();
      if (!tombamento && rowPhotos.length === 0) continue;

      let itemId;
      let patrimonioLabel;
      if (tombamento) {
        itemId = `MAN_${baseNow}_${Math.random().toString(36).slice(2, 6)}_${idx}`;
        patrimonioLabel = tombamento;
      } else {
        itemId = `ST_${baseNow}_${Math.random().toString(36).slice(2, 6)}_${idx}`;
        patrimonioLabel = "S/T";
      }
      while (existingIds.has(itemId)) {
        itemId = `${itemId}_${Math.random().toString(36).slice(2, 4)}`;
      }
      existingIds.add(itemId);

      const item = {
        id: itemId,
        patrimonioLabel,
        ...(tombamento ? { tomboRef: tombamento } : {}),
        data: new Date().toLocaleDateString("pt-BR"),
        especie: String(shared.especie || inferEspecieFromDesc(desc, sugestoes?.especies) || "").toUpperCase(),
        descricao: desc,
        marca: shared.marca || "",
        fornecedor: shared.fornecedor || "",
        empenho: "",
        nf: "",
        dataNF: "",
        valor: parseFloat(shared.valor) || 0,
        valorAtual: 0,
        isManual: true,
        tipoEntrada: multiOrigem,
        ...(patrimonioLabel === "S/T" ? { semTombo: true, identificadoPorFoto: rowPhotos.length > 0 } : {}),
      };

      let fotoUrls = [];
      if (rowPhotos.length > 0 && isStorageOk() && navigator.onLine) {
        try {
          const compressed = await compressPhotoArray(rowPhotos);
          fotoUrls = await uploadPhotos(compressed, itemId);
        } catch (e) {
          console.warn("Falha upload fotos linha", idx, e);
        }
      }

      try {
        await fsSet("manuais", itemId, { ...item, unidadeId: unidadeAtiva.id });
        await found.markFound({
          itemId,
          estado: row.estado || "Bom",
          situacao: "Em uso",
          localId: shared.localId,
          obs: String(row.obs || "").trim(),
          marca: shared.marca || "",
          origem: multiOrigem,
          fotoUrls,
          extras: {
            ...(patrimonioLabel === "S/T"
              ? { semTombo: true, identificadoPorFoto: rowPhotos.length > 0, descricaoEdit: desc }
              : { descricaoEdit: desc }),
            ...multiDoacaoExtras,
          },
          unidadeAtiva,
          logado: auth.logado,
          isManual: true,
        });
        saved++;
      } catch (e) {
        console.error("Erro salvando linha", idx, e);
      }
    }

    multiRowsPhotosRef.current = {};
    setModal(null);
    showT(`${saved} item(s) cadastrado(s)`);
  };

  const addSemTomboPendentes = async () => {
    if (!assertPodeEditar()) return;
    const selected = Array.isArray(formRef.current.stSelectedIds) ? formRef.current.stSelectedIds : [];
    if (!selected.length) {
      showT("Selecione ao menos um item pendente");
      return;
    }
    const localId = String(getField("stLocal") || "").trim();
    if (!localId) {
      showT("Selecione um local da sessão");
      return;
    }
    if (!formRef.current.stPhotos?.length) {
      showT("Tire pelo menos uma foto");
      return;
    }

    const estado = getField("stEstado") || "Bom";
    const stObsBatch = String(getField("stObs") || "").trim();
    const batchExtras = { alocadoManualmente: true, fotoCompartilhada: true };

    if (!navigator.onLine) {
      const steps = [];
      let count = 0;
      for (const itemId of selected) {
        const item = inventario.allItens.find((i) => i.id === itemId);
        if (!item || isItemInventariado(itemId, found.foundSet)) continue;
        const unit = editScopeUnits.find((u) => u.id === item.unidadeId) || unidadeAtiva;
        const now = new Date();
        steps.push({
          collection: "inventario",
          docId: itemId,
          usePhotos: count === 0,
          content: {
            patrimonioId: itemId,
            unidadeId: unit?.id || "",
            unidadeNome: unit?.nome || "",
            estado: defaultEstadoForItem(item) === "Novo" ? "Novo" : estado,
            situacao: item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso",
            localId,
            obs: stObsBatch,
            marca: item.marca || "",
            origem: item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio",
            fotoUrls: [],
            data: now.toLocaleDateString("pt-BR"),
            hora: now.toLocaleTimeString("pt-BR"),
            usuario: auth.logado?.nome || "",
            email: auth.logado?.email || "",
            ultimaAtualizacao: now.toISOString(),
            user: auth.logado?.nome || "",
            ...batchExtras,
          },
        });
        await found.markFound({
          itemId,
          estado: defaultEstadoForItem(item) === "Novo" ? "Novo" : estado,
          situacao: item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso",
          localId,
          obs: stObsBatch,
          marca: item.marca || "",
          origem: item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio",
          fotoUrls: [],
          extras: batchExtras,
          unidadeAtiva: unit,
          itemUnit: unit,
          logado: auth.logado,
          localOnly: true,
        });
        count++;
      }
      if (count > 0) {
        await queueOfflineWithPhotos({
          type: "batch",
          data: { steps, uploadPrefix: `batch/${Date.now()}_${selected[0]}` },
          photos: formRef.current.stPhotos || [],
        });
        updateQueueStatus();
      }
      revokeBlobUrls(formRef.current.stPhotos || []);
      setModal(null);
      showT(count > 1 ? `${count} itens na fila (offline)` : count ? "Na fila (offline)" : "Nenhum item válido");
      return;
    }

    let fotoUrls = [];
    if (isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.stPhotos);
        const prefix = `batch/${Date.now()}_${selected[0]}`;
        fotoUrls = await uploadPhotos(compressed, prefix);
      } catch {
        showT("Erro ao enviar fotos");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    const estadoBatch = getField("stEstado") || "Bom";
    let count = 0;
    for (const itemId of selected) {
      const item = inventario.allItens.find((i) => i.id === itemId);
      if (!item || isItemInventariado(itemId, found.foundSet)) continue;
      const unit = inventario.unidadesAtivas.find((u) => u.id === item.unidadeId) || unidadeAtiva;
      await found.markFound({
        itemId,
        estado: defaultEstadoForItem(item) === "Novo" ? "Novo" : estadoBatch,
        situacao: item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso",
        localId,
        obs: stObsBatch,
        marca: item.marca || "",
        origem: item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio",
        fotoUrls,
        extras: batchExtras,
        unidadeAtiva: unit,
        itemUnit: unit,
        logado: auth.logado,
        updateQueueStatus,
      });
      count++;
    }

    revokeBlobUrls(formRef.current.stPhotos || []);
    setModal(null);
    showT(count > 1 ? `${count} itens registrados com a mesma foto` : "Salvo!");
  };

  const openLinkTomboModal = (stItem, stFound, preselectId = "") => {
    let realId = preselectId || "";
    if (!realId && stItem) {
      const stUnitId = stItem.unidadeId || stFound?.unidadeId;
      const pool = scopeAllItens.filter((i) => {
        if (i.id === stItem.id) return false;
        if (isSemTomboItem(i, found.foundMap[i.id])) return false;
        if (String(i.id || "").startsWith("ST_") || String(i.id || "").startsWith("MAN_")) return false;
        if (found.foundSet.has(i.id)) return false;
        if (stUnitId && i.unidadeId && i.unidadeId !== stUnitId) return false;
        return true;
      });
      const top = rankTombosForAjuste(stItem, stFound, pool, { minScore: 0, limit: 1 })[0];
      if (top?.score >= 40) realId = top.item.id;
    }
    formRef.current = {
      ...formRef.current,
      ajusteStId: stItem?.id || "",
      ajusteStItem: stItem,
      ajusteStFound: stFound,
      ajusteSearch: "",
      ajusteRealId: realId,
    };
    bumpFt();
    setModal("ajusteLink");
  };

  const linkSemTomboToTombo = async () => {
    const stId = String(formRef.current.ajusteStId || "").trim();
    const realId = String(formRef.current.ajusteRealId || "").trim();
    if (!stId || !realId) {
      showT("Selecione o tombo de destino");
      return;
    }
    if (stId === realId) {
      showT("Selecione um tombo diferente");
      return;
    }
    if (isItemInventariado(realId, found.foundSet)) {
      showT("Este tombo já foi inventariado");
      return;
    }

    if (navigator.onLine) {
      try {
        const serverDest = await fsGetDoc("inventario", realId);
        if (serverDest?.ultimaAtualizacao || serverDest?.patrimonioId) {
          showT("Este tombo já foi inventariado por outro usuário");
          return;
        }
      } catch {}
    }

    const stFound = getFoundEntry(stId, found.foundMap);
    if (!stFound) {
      showT("Registro sem tombo não encontrado");
      return;
    }

    let realItem = null;
    let realUnit = null;
    for (const u of unidades) {
      const hit = u.itens.find((i) => i.id === realId);
      if (hit) {
        realItem = hit;
        realUnit = u;
        break;
      }
    }
    if (!realItem) {
      showT("Tombo de destino não encontrado no patrimônio");
      return;
    }
    if (isSemTomboItem(realItem, getFoundEntry(realId, found.foundMap))) {
      showT("Destino também é item sem tombo");
      return;
    }

    setBusy(true);
    try {
      const stItem = scopeAllItens.find((i) => i.id === stId) || formRef.current.ajusteStItem;
      const unit = editScopeUnits.find((u) => u.id === (stFound.unidadeId || stItem?.unidadeId)) || unidadeAtiva;
      const entry = {
        ...stFound,
        patrimonioId: realId,
        unidadeId: realUnit.id,
        unidadeNome: realUnit.nome,
        vinculadoDeSemTombo: true,
        alocadoManualmente: true,
        semTomboOrigemId: stId,
        semTomboOrigemDesc: stFound.descricaoEdit || stItem?.descricao || "",
        tomboLabelFisico: String(stFound.tomboReferencia || stItem?.patrimonioLabel || stId).trim() || "",
        semTombo: false,
        identificadoPorFoto: false,
        ultimaAtualizacao: new Date().toISOString(),
      };
      delete entry._id;

      await fsSet("inventario", realId, entry);
      await fsDel("inventario", stId);
      try {
        await fsDel("manuais", stId);
      } catch {}

      const nextFound = found.found.filter((f) => f.patrimonioId !== stId);
      nextFound.push({ ...entry, _id: realId, patrimonioId: realId });
      found.setFound(nextFound);
      bumpCacheBuster();
      await setCachedData("inventario", nextFound);

      setUnidades((prev) =>
        prev.map((u) => ({
          ...u,
          itens: u.itens.filter((i) => i.id !== stId),
        })),
      );
      inventario.setUnidadesAtivas((prev) =>
        prev.map((u) => ({
          ...u,
          itens: u.itens.filter((i) => i.id !== stId),
        })),
      );

      if (finalizadoEdit?.fin?.id && !finalizadoEdit.fin.legacy) {
        const stats = buildFinalizacaoStats(finalizadoEdit.units, found.foundSet);
        atualizarStatsFinalizacao(finalizadoEdit.fin.id, stats);
      }

      await logAuditoria("link-tombo", "inventario", realId, stFound, entry);
      setModal(null);
      showT(`Vinculado ao tombo ${realItem.patrimonioLabel || realId}`);
    } catch (e) {
      showT(e?.message || "Erro ao vincular tombo");
    } finally {
      setBusy(false);
    }
  };

  const confirmarTomboDivergente = async (foundId, foundEntry) => {
    if (!assertPodeEditar()) return;
    const docId = String(foundEntry?.patrimonioId || foundId || "").trim();
    if (!docId) return;
    const cur = getFoundEntry(docId, found.foundMap) || foundEntry;
    if (!cur) {
      showT("Registro não encontrado");
      return;
    }
    setBusy(true);
    try {
      const entry = {
        ...cur,
        tomboEstrangeiroOk: true,
        ultimaAtualizacao: new Date().toISOString(),
      };
      delete entry._id;
      await fsSet("inventario", docId, entry);
      const next = found.found.map((f) =>
        String(f.patrimonioId || f._id) === docId ? { ...entry, _id: docId, patrimonioId: docId } : f
      );
      found.setFound(next);
      bumpCacheBuster();
      await setCachedData("inventario", next);
      showT("Tombo divergente aceito — registro mantido");
    } catch (e) {
      showT(e?.message || "Erro ao confirmar");
    } finally {
      setBusy(false);
    }
  };

  const getSemTomboPendentes = () => {
    const q = String(formRef.current.stPendSearch || "").trim().toLowerCase();
    return scopeAllItens.filter((i) => {
      if (hideIncorporados && (i.tipoEntrada || "") === "Incorporado") return false;
      if (isItemInventariado(i.id, found.foundSet)) return false;
      if (isSemTomboItem(i, getFoundEntry(i.id, found.foundMap))) return false;
      if (!q) return true;
      return (
        String(i.id || "").toLowerCase().includes(q) ||
        String(i.descricao || "").toLowerCase().includes(q) ||
        String(i.especie || "").toLowerCase().includes(q) ||
        String(i.fornecedor || "").toLowerCase().includes(q) ||
        String(i.marca || "").toLowerCase().includes(q) ||
        String(i.nf || "").toLowerCase().includes(q)
      );
    });
  };

  const toggleStPending = (id) => {
    const cur = new Set(formRef.current.stSelectedIds || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    formRef.current.stSelectedIds = [...cur];
    bumpFt();
  };

  const gerarRelatorio = async (formato = "pdf") => {
    if (!unidadeAtiva?.id) {
      showT("Selecione uma unidade");
      return;
    }

    try {
      setBusy(true);
      if (formato === "pdf") {
        const doc = await gerarRelatorioPDF(unidadeAtiva.id, unidades, found.found);
        doc.save(`relatorio_${unidadeAtiva.id}_${Date.now()}.pdf`);
      } else {
        const { workbook, XLSX } = await gerarRelatorioExcel(unidadeAtiva.id, unidades, found.found);
        XLSX.writeFile(workbook, `relatorio_${unidadeAtiva.id}_${Date.now()}.xlsx`);
      }
      await logAuditoria("export", "relatorio", unidadeAtiva.id, null, { formato });
      showT(`Relatório em ${formato.toUpperCase()} gerado`);
    } catch {
      showT("Erro ao gerar relatório");
    } finally {
      setBusy(false);
    }
  };

  const fazerBackup = async () => {
    try {
      setBusy(true);
      const backup = await criarBackupManual();
      notificationService.notify(EVENTOS.BACKUP_CRIADO, {
        message: `Backup ${backup.id} criado`,
        type: "success",
      });
      showT(`Backup criado (${(backup.tamanho / 1024).toFixed(0)}KB)`);
    } catch {
      showT("Erro ao criar backup");
    } finally {
      setBusy(false);
    }
  };

  const finalizarInv = async () => {
    const pendentes = inventario.allItens.filter((i) => !isItemInventariado(i.id, found.foundSet));
    for (const item of pendentes) {
      const ne = { patrimonioId: item.id, descricao: item.descricao, especie: item.especie, unidade: item.unidadeNome, dataFin: new Date().toLocaleDateString("pt-BR") };
      await fsSet("tombosNE", item.id, ne);
    }
    found.setTombosNE((prev) => [...prev, ...pendentes.map((i) => ({ ...i, unidade: i.unidadeNome, dataFin: new Date().toLocaleDateString("pt-BR") }))]);
    // Clear active inventory and paused sessions when finalizing!
    inventario.clearAtivas();
    setModal(null);
    showT(`Finalizado! ${pendentes.length} não encontrado(s)`);
  };

  const finalizarComCoordenadora = async () => {
    if (finalizandoRef.current || busy) {
      showT("Finalização em andamento — aguarde");
      return;
    }
    const nome = String(getField("coordNome") || "").trim();
    const matricula = String(getField("coordMatricula") || "").trim();
    if (!nome || !matricula) {
      showT("Preencha nome e matrícula da coordenadora");
      return;
    }
    if (inventario.unidadesAtivas.length === 0) {
      showT("Nenhuma unidade em inventário");
      return;
    }

    finalizandoRef.current = true;
    setBusy(true);

    try {
      const token = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const agora = new Date();
      const dataExpiracao = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
      const unidadeIds = inventario.unidadesAtivas.map((u) => u.id);
      const unidadeNomes = inventario.unidadesAtivas.map((u) => u.nome);

      const convite = {
        token,
        unidadeId: unidadeAtiva?.id || unidadeIds[0],
        unidadeNome: unidadeAtiva?.nome || unidadeNomes[0],
        unidadeIds,
        unidadeNomes,
        matricula,
        nomeSugerido: nome,
        status: "ativo",
        dataCriacao: agora.toISOString(),
        dataExpiracao: dataExpiracao.toISOString(),
        dataUso: null,
      };
      await fsSet("convites", token, convite);

      const base = import.meta.env.BASE_URL || "/";
      const prefix = base.endsWith("/") ? base : `${base}/`;
      const link = `${window.location.origin}${prefix}#/coordregistro/${token}`;
      setCoordRegistroLink(link);
      const qrUrl = await generateQRCode(link);
      setQrCodeUrl(qrUrl);

      const pendentes = inventario.allItens.filter((i) => !isItemInventariado(i.id, found.foundSet));
      const dataFin = new Date().toLocaleDateString("pt-BR");
      for (const item of pendentes) {
        const ne = { patrimonioId: item.id, descricao: item.descricao, especie: item.especie, unidade: item.unidadeNome, dataFin, coordenadora: nome, matricula };
        await fsSet("tombosNE", item.id, ne);
      }
      found.setTombosNE((prev) => [...prev, ...pendentes.map((i) => ({ ...i, unidade: i.unidadeNome, dataFin, coordenadora: nome, matricula }))]);

      const stats = buildFinalizacaoStats(inventario.unidadesAtivas, found.foundSet);
      try {
        await criarFinalizacao({
          unidadeIds,
          unidadeNomes,
          sessionId: inventario.sessionId || "",
          coordenadora: { nome, matricula },
          conviteToken: token,
          stats,
          finalizedBy: {
            uid: auth.logado?.uid || "",
            nome: auth.logado?.nome || "",
            email: auth.logado?.email || "",
          },
        });
        finalizacoesState.refresh?.();
      } catch {
        showT("Finalizado, mas falha ao registrar na lista de Finalizados");
      }

      // Clear active inventory and paused sessions when finalizing!
      inventario.clearAtivas();
      setModal("qrcode-resultado");
      showT("Convite criado! A coordenadora se cadastra pelo QR Code e você aprova em Coordenadores.");
    } catch (err) {
      console.error("Erro ao finalizar:", err);
      showT("Erro ao finalizar — tente novamente");
    } finally {
      setBusy(false);
      finalizandoRef.current = false;
    }
  };

  if (auth.loading)
    return (
      <div className="gov-loading">
        <div className="gov-spinner" aria-hidden="true" />
        <p style={{ color: "var(--gov-text-muted)", fontSize: 13 }}>Carregando inventário...</p>
      </div>
    );

  if (!auth.logado)
    return (
      <LoginPage
        firebaseOk={firebaseOk}
        isProd={isProd}
        loginError={auth.loginError}
        onEmail={(v) => setField("email", v)}
        onSenha={(v) => setField("senha", v)}
        onSubmit={() => auth.login(getField("email"), getField("senha"))}
        inp={inp}
        bp={bp}
      />
    );

  const banner =
    found.uploading && (
      <div className="gov-banner gov-banner--info">
        {found.uploadMsg || "Enviando fotos..."}
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "var(--gov-bg)" }}>
      {campanhaState.fechada && (
        <div className="gov-banner gov-banner--danger">
          Inventário fechado — apenas consulta. Novos registros estão bloqueados.
        </div>
      )}
      <NavBar
        navs={navs}
        activeTab={tab}
        onTabChange={setTab}
        isMobile={isMob}
        logado={auth.logado}
        unidadesAtivas={inventario.unidadesAtivas}
        offlineStatus={renderOfflineStatus()}
        banner={banner}
        onReloadXlsx={() => loadXlsx(true)}
        loadingXlsx={loadingXlsx}
        onLogout={auth.logout}
        storageOk={isStorageOk()}
      >
        {tab === "inventario" && (
          <Suspense fallback={tabFallback}>
          <LazyInventarioPage
            invSubTab={inventario.invSubTab}
            setInvSubTab={inventario.setInvSubTab}
            unidades={unidades}
            unidadesAtivas={inventario.unidadesAtivas}
            pendingUnids={inventario.pendingUnids}
            setPendingUnids={inventario.setPendingUnids}
            confirmarAtivas={inventario.confirmarAtivas}
            removeAtiva={inventario.removeAtiva}
            retomarSessaoPausada={inventario.retomarSessaoPausada}
            sessoesPausadas={inventario.sessoesPausadas}
            pausedUnitIds={inventario.pausedUnitIds}
            foundSet={found.foundSet}
            foundMap={found.foundMap}
            activeLocalId={inventario.activeLocalId}
            setActiveLocalId={inventario.setActiveLocalId}
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            totalFound={sessionTotalFound}
            totalBens={sessionTotalBens}
            progresso={sessionProgresso}
            hideIncorporados={hideIncorporados}
            setHideIncorporados={persistHideIncorporados}
            filtered={sortedFiltered}
            search={search}
            setSearch={setSearch}
            hideFound={hideFound}
            setHideFound={setHideFound}
            openDetModal={openDetModal}
            onOpenLocalDetail={(local) => setLocalDetalhe(local)}
            onOpenMulti={() => {
              if (!multiSharedRef.current) {
                multiSharedRef.current = {
                  descricao: "",
                  especie: "",
                  marca: "",
                  fornecedor: "",
                  valor: "",
                  localId: sessionLocais[0]?.id || "",
                  origem: "Próprio",
                  multiDoacaoModo: "uf",
                  multiDoacaoUf: "MA",
                  multiDoacaoTexto: "",
                };
              }
              if (!multiRowsRef.current) {
                multiRowsRef.current = [
                  { tombamento: "", estado: "Bom", obs: "" },
                  { tombamento: "", estado: "Bom", obs: "" },
                ];
              }
              multiRowsPhotosRef.current = {};
              setModal("multi");
            }}
            onOpenManual={(localId) => {
              formRef.current = {
                manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
                manPatrimonio: "",
                manLocal: String(localId || ""),
                manQtd: 1,
                manSharePhotos: true,
                manOrigem: "Próprio",
                manDoacaoModo: "uf",
                manDoacaoUf: "MA",
                manDoacaoTexto: "",
              };
              bumpFt();
              setModal("manual");
            }}
            onOpenSemTombo={(localId) => {
              formRef.current = {
                stMode: "novo",
                stDesc: "",
                stLocal: String(localId || sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stOrigem: "Próprio",
                stDoacaoModo: "uf",
                stDoacaoUf: "MA",
                stDoacaoTexto: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenFotoVarios={() => {
              formRef.current = {
                stMode: "pendentes",
                stDesc: "",
                stLocal: String(sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stOrigem: "Próprio",
                stDoacaoModo: "uf",
                stDoacaoUf: "MA",
                stDoacaoTexto: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenLinkTombo={openLinkTomboModal}
            onOpenFinalizar={() => setModal("finalizar")}
            onOpenCancelar={() => setModal("cancelar-inventario")}
            onOpenConvidarColega={isAdmin ? abrirConvidarColega : undefined}
            sessionId={inventario.sessionId}
            locais={sessionLocais}
            onOpenNextPending={openNextPending}
            campanhaFechada={campanhaState.fechada}
            teamOnline={teamOnline}
            myUid={auth.logado?.uid || ""}
            onQuickAddLocal={async (nome) => {
              const entry = await createSessionLocal(nome);
              if (entry) showT("Local da sessão adicionado");
            }}
            onDeleteLocal={handleDeleteLocal}
            showT={showT}
            onViewImage={onViewImage}
          />
          </Suspense>
        )}

        {tab === "finalizados" && (
          <Suspense fallback={tabFallback}>
          <LazyFinalizadosPage
            finalizacoes={finalizacoesState.finalizacoes}
            loading={finalizacoesState.loading}
            onRefresh={finalizacoesState.refresh}
            editFin={finalizadoEdit?.fin || null}
            editUnits={finalizadoEdit?.units || []}
            onEdit={(fin) => {
              const units = (fin.unidadeIds || []).map((id) => unidades.find((u) => u.id === id)).filter(Boolean);
              if (!units.length) {
                showT("Unidade não encontrada no cadastro");
                return;
              }
              setFinalizadoEdit({ fin, units });
              registrarEdicaoFinalizacao(fin.id, auth.logado);
            }}
            onCloseEdit={() => setFinalizadoEdit(null)}
            foundSet={found.foundSet}
            foundMap={found.foundMap}
            locais={sessionLocais}
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            openDetModal={openDetModal}
            onOpenLocalDetail={(local) => setLocalDetalhe(local)}
            onOpenSemTombo={(localId) => {
              formRef.current = {
                stMode: "novo",
                stDesc: "",
                stLocal: String(localId || sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || editScopeUnits[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenFotoVarios={() => {
              formRef.current = {
                stMode: "pendentes",
                stDesc: "",
                stLocal: String(sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || editScopeUnits[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenLinkTombo={openLinkTomboModal}
            onConfirmTomboDivergente={confirmarTomboDivergente}
            onOpenManual={(localId) => {
              formRef.current = {
                manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
                manPatrimonio: "",
                manLocal: String(localId || sessionLocais[0]?.id || ""),
                manQtd: 1,
                manSharePhotos: true,
              };
              bumpFt();
              setModal("manual");
            }}
            sessionId={editScopeSessionId}
            showT={showT}
            onQuickAddLocal={async (nome) => {
              const entry = await createSessionLocal(nome);
              if (entry) showT("Local adicionado");
            }}
            onDeleteLocal={handleDeleteLocal}
            onViewImage={onViewImage}
            campanhaFechada={campanhaState.fechada}
            logado={auth.logado}
          />
          </Suspense>
        )}

        {tab === "busca" && (
          <Suspense fallback={tabFallback}>
          <LazyBuscaPage
            globalSearch={globalSearch}
            globalResults={globalResults}
            globalSearching={globalSearching}
            onSearchChange={(v) => {
              setGlobalSearch(v);
              clearTimeout(formRef.current._gsT);
              formRef.current._gsT = setTimeout(() => doGlobalSearch(v), 300);
            }}
            onOpenItem={(item) => openDetModal(item)}
            foundMap={found.foundMap}
            unidades={unidades}
            saveAtiva={inventario.saveAtiva}
            isMob={isMob}
            inp={inp}
            cd={cd}
          />
          </Suspense>
        )}

        {tab === "itens" && (
          <Suspense fallback={tabFallback}>
          <LazyItensPage
            todosItens={todosItens}
            unidades={unidades}
            foundMap={found.foundMap}
            foundSet={found.foundSet}
            saveAtiva={inventario.saveAtiva}
            formRef={formRef}
            bumpFt={bumpFt}
            setModal={setModal}
            isMob={isMob}
            inp={inp}
            cd={cd}
            bs={bs}
            onViewImage={onViewImage}
          />
          </Suspense>
        )}

        {tab === "nf" && (
          <Suspense fallback={tabFallback}>
          <LazyNotasFiscaisPage
            nfDataList={nfDataList}
            nfSearch={nfSearch}
            setNfSearch={setNfSearch}
            nfTipo={nfTipo}
            setNfTipo={setNfTipo}
            nfPage={nfPage}
            setNfPage={setNfPage}
            NF_PER_PAGE={NF_PER_PAGE}
            origemMeta={origemMeta}
            foundSet={found.foundSet}
            foundMap={found.foundMap}
            unidades={unidades}
            saveAtiva={inventario.saveAtiva}
            onOpenItem={openDetModal}
            isMob={isMob}
            inp={inp}
            cd={cd}
            bs={bs}
          />
          </Suspense>
        )}

        {tab === "tombos" && (
          <Suspense fallback={tabFallback}>
            <LazyTombosPage tombosNE={found.tombosNE} tombosDup={tombosDup} tombosTab={tombosTab} setTombosTab={setTombosTab} isMob={isMob} bp={bp} bs={bs} cd={cd} />
          </Suspense>
        )}

        {tab === "dash" && (
          <Suspense fallback={tabFallback}>
            <LazyDashboardPage
              totalBens={inventario.totalBens}
              totalFound={inventario.totalFound}
              progresso={inventario.progresso}
              gerarRelatorio={gerarRelatorio}
              fazerBackup={fazerBackup}
              found={found.found}
              xlsxCorrompidos={xlsxCorrompidos}
              unidades={unidades}
              saveAtiva={inventario.saveAtiva}
              setTab={setTab}
              showT={showT}
              isMob={isMob}
              bp={bp}
              bs={bs}
              cd={cd}
              campanha={campanhaState.campanha}
              campanhaFechada={campanhaState.fechada}
              onFecharCampanha={campanhaState.fechar}
              onReabrirCampanha={campanhaState.reabrir}
              isAdmin={canGerirCoord}
            />
          </Suspense>
        )}

        {tab === "coordenadores" && <CoordenadoresTab unidades={unidades} showT={showT} isMob={isMob} />}
        {tab === "correcao" && canGerirCoord && (
          <Suspense fallback={tabFallback}>
            <LazyCorrecaoNomesPage
              todosItens={todosItens}
              unidades={unidades}
              foundMap={found.foundMap}
              especies={gerarSugestoesEspecie(todosItens)}
              inferEspecieFromDesc={inferEspecieFromDesc}
              onAplicarCorrecao={aplicarCorrecaoNomes}
              onViewImage={onViewImage}
              showT={showT}
              busy={busy}
              isMob={isMob}
              inp={inp}
              cd={cd}
              bs={bs}
            />
          </Suspense>
        )}
        {tab === "inventariantes" && <InventariantesTab showT={showT} isMob={isMob} />}
      </NavBar>

      {modal === "camera" && (
        <CameraModal
          existingPhotos={
            cameraTarget === "manual"
              ? formRef.current.manPhotos || []
              : cameraTarget === "semTombo"
                ? formRef.current.stPhotos || []
                : formRef.current.detNewBase64 || []
          }
          onCapture={onCameraCapture}
          onClose={closeCameraModal}
          onPhotosChange={persistCameraSession}
          onBeforeNativeCapture={() => saveSessionResume({ modal: "camera", cameraTarget: cameraTargetRef.current || "detalhe" })}
        />
      )}

      {modal === "detalhe" && formRef.current.detItem && (
        <Overlay
          isMobile={isMob}
          suppressBackdropMs={isMob ? Math.max(overlayBackdropSuppressMs, 1200) : overlayBackdropSuppressMs}
          onClose={closeDetModal}
        >
          <ItemDetailModal
            item={formRef.current.detItem}
            foundEntry={getFoundEntry(formRef.current.detItem.id, found.foundMap)}
            foundSet={found.foundSet}
            locais={pickLocais}
            origemMeta={origemMeta}
            isMobile={isMob}
            ft={ft}
            bumpFt={bumpFt}
            formRef={formRef}
            setField={setField}
            getField={getField}
            sugestoes={sugestoes}
            onOpenCamera={openCamera}
            onViewImage={onViewImage}
            onClose={closeDetModal}
            onSave={async () => {
              if (!assertPodeEditar()) return;
              formRef.current.detForceWrite = false;
              await found.saveDetail({
                formRef,
                getField,
                unidadeAtiva: resolveItemUnit(formRef.current.detItem),
                itemUnit: resolveItemUnit(formRef.current.detItem),
                logado: auth.logado,
                updateQueueStatus,
                closeModal: closeDetModal,
                onConflict: (serverEntry) => {
                  setSaveConflict({
                    serverEntry,
                    item: formRef.current.detItem,
                    who: serverEntry?.usuario || serverEntry?.user || "outro usuário",
                    when: serverEntry?.ultimaAtualizacao || serverEntry?.hora || "",
                  });
                },
              });
              if (getField("detLocal")) {
                inventario.setActiveLocalId(getField("detLocal"));
              }
            }}
            onDelete={async () => {
              await found.deleteFound(formRef.current.detItem.id);
              closeDetModal();
              showT("Removido");
            }}
          />
        </Overlay>
      )}

      {saveConflict && (
        <Overlay isMobile={isMob} onClose={() => setSaveConflict(null)}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#b45309" }}>Conflito ao salvar</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
              <strong>{saveConflict.who}</strong> salvou este item
              {saveConflict.when ? ` (${new Date(saveConflict.when).toLocaleString("pt-BR")})` : ""}. Recarregar os dados do servidor?
            </p>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  applyServerEntryToDetForm(saveConflict.serverEntry);
                  setSaveConflict(null);
                  showT("Dados recarregados do servidor");
                }}
                style={{ ...bp, flex: 1 }}
              >
                Recarregar
              </button>
              <button
                onClick={async () => {
                  formRef.current.detForceWrite = true;
                  setSaveConflict(null);
                  await found.saveDetail({
                    formRef,
                    getField,
                    unidadeAtiva: resolveItemUnit(formRef.current.detItem),
                    itemUnit: resolveItemUnit(formRef.current.detItem),
                    logado: auth.logado,
                    updateQueueStatus,
                    closeModal: closeDetModal,
                  });
                  if (getField("detLocal")) {
                    inventario.setActiveLocalId(getField("detLocal"));
                  }
                }}
                style={{ ...bs, flex: 1, color: "#b45309", borderColor: "#fcd34d" }}
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === "manual" && (
        <ManualModal
          isMob={isMob}
          overlayBackdropSuppressMs={overlayBackdropSuppressMs}
          revokeBlobUrls={revokeBlobUrls}
          formRef={formRef}
          clearUiResume={clearUiResume}
          setModal={setModal}
          getField={getField}
          setField={setField}
          inferEspecieFromDesc={inferEspecieFromDesc}
          sugestoes={sugestoes}
          bumpFt={bumpFt}
          manualPatrimonioRef={manualPatrimonioRef}
          bs={bs}
          inp={inp}
          bp={bp}
          ESTADOS={ESTADOS}
          EC={EC}
          SITUACOES={SITUACOES}
          pickLocais={pickLocais}
          openCamera={openCamera}
          onViewImage={onViewImage}
          addManual={addManual}
          ft={ft}
          lookupTombo={lookupTombo}
          onOpenExistingItem={(item) => {
            revokeBlobUrls(formRef.current.manPhotos || []);
            formRef.current.manPhotos = [];
            openDetModal(item);
          }}
        />
      )}

      {localDetalhe && (
        <LocalDetailModal
          local={localDetalhe}
          isMob={isMob}
          unidadesAtivas={inventario.unidadesAtivas}
          foundMap={found.foundMap}
          onClose={() => setLocalDetalhe(null)}
          onOpenItem={(item) => openDetModal(item)}
          onAddManual={(localId) => {
            setLocalDetalhe(null);
            formRef.current = {
              manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
              manPatrimonio: "",
              manLocal: String(localId || ""),
              manQtd: 1,
              manSharePhotos: true,
              manOrigem: "Próprio",
            };
            bumpFt();
            setModal("manual");
          }}
          onAddSemTombo={(localId) => {
            setLocalDetalhe(null);
            formRef.current = {
              stMode: "novo",
              stDesc: "",
              stLocal: String(localId || sessionLocais[0]?.id || ""),
              stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
              stEstado: "Bom",
              stObs: "",
              stTomboRef: "",
              stMarca: "",
              stOrigem: "Próprio",
              stPhotos: [],
              stSelectedIds: [],
              stPendSearch: "",
            };
            bumpFt();
            setModal("semTombo");
          }}
          onViewImage={onViewImage}
          bp={bp}
          bs={bs}
        />
      )}

      {modal === "multi" && (
        <MultiItemModal
          isMob={isMob}
          unidadeAtiva={inventario.unidadesAtivas[0]}
          sessionLocais={sessionLocais}
          sugestoes={sugestoes}
          rowsPhotosRef={multiRowsPhotosRef}
          sharedRef={multiSharedRef}
          rowsRef={multiRowsRef}
          onClose={() => {
            Object.values(multiRowsPhotosRef.current || {}).forEach((arr) => revokeBlobUrls(arr));
            multiRowsPhotosRef.current = {};
            multiSharedRef.current = null;
            multiRowsRef.current = null;
            setModal(null);
          }}
          onOpenCamera={(target) => openCamera(target)}
          onSubmit={addMultiItems}
          bp={bp}
          bs={bs}
          inp={inp}
        />
      )}

      {modal === "addLocal" && (
        <AddLocalModal
          isMob={isMob}
          setModal={setModal}
          setField={setField}
          getField={getField}
          createSessionLocal={createSessionLocal}
          showT={showT}
          bs={bs}
          bp={bp}
          inp={inp}
        />
      )}

      {modal === "convite-inventariante" && (
        <Overlay
          isMobile={isMob}
          onClose={() => {
            setModal(null);
            setInvConviteLink("");
            setInvConviteExp("");
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>Convidar colega para inventário</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            Envie o link para a pessoa se cadastrar. Após o cadastro, aprove em Inventariantes (admin) e ela poderá inventariar na mesma unidade com você.
          </p>
          {gerandoInvConvite ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", textAlign: "center", padding: 20 }}>Gerando link…</p>
          ) : invConviteLink ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#15803d" }}>Link válido por 7 dias</p>
              {invConviteExp && (
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>
                  Até {new Date(invConviteExp).toLocaleDateString("pt-BR")}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 11, color: "#0f172a", wordBreak: "break-all", lineHeight: 1.4 }}>{invConviteLink}</p>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setModal(null);
                setInvConviteLink("");
              }}
              style={{ ...bs, flex: 1 }}
            >
              Fechar
            </button>
            {invConviteLink && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invConviteLink);
                    showT("Link copiado");
                  } catch {
                    showT("Copie o link manualmente");
                  }
                }}
                style={{ ...bp, flex: 1 }}
              >
                Copiar link
              </button>
            )}
          </div>
        </Overlay>
      )}

      {modal === "finalizar" && (
        <FinalizarModal
          isMob={isMob}
          setModal={setModal}
          inventario={inventario}
          getField={getField}
          setField={setField}
          finalizarComCoordenadora={finalizarComCoordenadora}
          busy={busy}
          bs={bs}
          bp={bp}
          inp={inp}
        />
      )}

      {modal === "qrcode-resultado" && qrCodeUrl && (
        <Overlay
          isMobile={isMob}
          onClose={() => {
            setModal(null);
            setQrCodeUrl(null);
            setCoordRegistroLink("");
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Acesso da coordenadora</h2>
            <p style={{ color: "#64748b", margin: "0 0 12px", fontSize: 13 }}>
              {getField("coordNome")} · matr. {getField("coordMatricula")}
            </p>
            <img src={qrCodeUrl} alt="QR Code" style={{ width: 240, maxWidth: "100%", height: "auto", margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: 8 }} />
            {coordRegistroLink && (
              <div style={{ marginTop: 12, textAlign: "left", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#475569" }}>Link de cadastro (válido por 7 dias)</p>
                <p style={{ margin: 0, fontSize: 11, color: "#0f172a", wordBreak: "break-all", lineHeight: 1.4 }}>{coordRegistroLink}</p>
              </div>
            )}
            <p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 12, lineHeight: 1.45, textAlign: "left" }}>
              1. Envie o QR Code ou o link para a coordenadora.<br />
              2. Ela abre no celular, cria a senha e aguarda aprovação.<br />
              3. Aprove o cadastro na aba Coordenadores.<br />
              4. Depois ela entra em /coord com e-mail e senha.
            </p>
            <div style={{ display: "flex", gap: 9, marginTop: 16, flexDirection: isMob ? "column" : "row" }}>
              {coordRegistroLink && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(coordRegistroLink);
                      showT("Link copiado");
                    } catch {
                      showT("Copie o link manualmente");
                    }
                  }}
                  style={{ ...bs, flex: 1 }}
                >
                  Copiar link
                </button>
              )}
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrCodeUrl;
                  a.download = `qr_coord_${Date.now()}.png`;
                  a.target = "_blank";
                  a.rel = "noopener";
                  a.click();
                }}
                style={{ ...bs, flex: 1 }}
              >
                Baixar QR
              </button>
              <button
                onClick={() => {
                  setModal(null);
                  setQrCodeUrl(null);
                  setCoordRegistroLink("");
                  inventario.clearAtivas();
                }}
                style={{ ...bp, flex: 1 }}
              >
                Concluir
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === "semTombo" && (
        <SemTomboModal
          isMob={isMob}
          revokeBlobUrls={revokeBlobUrls}
          formRef={formRef}
          setModal={setModal}
          bumpFt={bumpFt}
          getField={getField}
          setField={setField}
          sessionLocais={sessionLocais}
          openCamera={openCamera}
          inventario={inventario}
          sugestoes={sugestoes}
          getSemTomboPendentes={getSemTomboPendentes}
          toggleStPending={toggleStPending}
          getItemCode={getItemCode}
          addSemTomboPendentes={addSemTomboPendentes}
          addSemTomboItem={addSemTomboItem}
          bs={bs}
          bp={bp}
          inp={inp}
          ft={ft}
        />
      )}

      {modal === "ajusteLink" && formRef.current.ajusteStItem && (
        <AjusteLinkModal
          isMob={isMob}
          setModal={setModal}
          formRef={formRef}
          getField={getField}
          setField={setField}
          bumpFt={bumpFt}
          scopeAllItens={scopeAllItens}
          isSemTomboItem={isSemTomboItem}
          found={found}
          rankTombosForAjuste={rankTombosForAjuste}
          linkSemTomboToTombo={linkSemTomboToTombo}
          bs={bs}
          bp={bp}
          inp={inp}
          ft={ft}
        />
      )}

      {modal === "cancelar-inventario" && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#b91c1c" }}>Encerrar sessão de inventário?</h2>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991b1b", lineHeight: 1.55 }}>
                Isso remove as unidades selecionadas desta sessão e oculta os locais criados nela. Os itens já inventariados <strong>permanecem salvos</strong> no sistema.
              </p>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
              {inventario.unidadesAtivas.length} unidade{inventario.unidadesAtivas.length > 1 ? "s" : ""} · {inventario.totalFound} item{inventario.totalFound !== 1 ? "ns" : ""} registrado{inventario.totalFound !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bp, flex: 2 }}>
                Voltar ao inventário
              </button>
              <button
                onClick={() => {
                  inventario.clearAtivas();
                  inventario.setInvSubTab("inventariar");
                  setModal(null);
                  showT("Sessão encerrada");
                }}
                style={{ ...bs, flex: 1, color: "#b91c1c", borderColor: "#fca5a5" }}
              >
                Encerrar sessão
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {imgViewSrc && <ImageOverlay src={imgViewSrc} onClose={() => setImgViewSrc(null)} />}

      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(241,245,249,.72)", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
          <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#1351B4", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
          <p style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textAlign: "center" }}>Processando...</p>
        </div>
      )}

      <ToastNotification message={toast} isMobile={isMob} />
    </div>
  );
}

export default function App() {
  const firebaseOk = isFirebaseConfigured();
  const isProd = import.meta.env.PROD;
  return <OrganizedApp firebaseOk={firebaseOk} isProd={isProd} />;
}
