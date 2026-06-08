import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, PER_PAGE, SC, SITUACOES } from "../constants/inventory.js";
import { clearFirebaseSession, fsDel, fsGetAll, fsSet, isFirebaseConfigured, setFirebaseSession, fbLogin, fbRegister, refreshAuthToken, obterInventariantePorUid, gerarLinkConviteInventariante } from "../services/firebase.js";
import { getDisplayPhotoUrl, uploadPhotos, isStorageOk, deletePhoto } from "../services/storage.js";
import { generateQRCode } from "../services/qr-service.js";
import { criarBackupManual, logAuditoria, setupRealtimeSync } from "../services/audit.js";
import { EVENTOS, gerarRelatorioExcel, gerarRelatorioPDF, notificationService, offlineManager, queueOfflineWithPhotos } from "../services/features.js";
import { garantirCampanhaAberta } from "../services/campanha.js";
import { CATEGORY_TREE, getCategoryGroup, getSubcategoryLabel } from "./categories.js";
import { compressPhotoArray, getCachedData, bumpCacheBuster, perfMonitor, setCachedData } from "../utils/performance.js";
import { loadUnidades } from "../utils/xlsx.js";
import { gerarTodasSugestoes } from "../utils/suggestions.js";
import { defaultEstadoForItem, inferEspecieFromDesc, parseBrDate, sortByDataNF } from "../utils/itemHelpers.js";
import { detectTombosDuplicados } from "../utils/tomboDup.js";
import { buildFormSnapshot, buildItemSnapshot, clearUiResume, loadUiResume, saveUiResume } from "../utils/uiResume.js";
import { filterLocaisForSession, mergeFoundRecords, resolveUnitForItem } from "../utils/inventorySession.js";
import { clearInventoryPresence, loadActiveInventors, pingInventoryPresence } from "../utils/inventoryPresence.js";
import { isSemTomboItem } from "../utils/semTombo.js";
import { getFoundEntry, isItemInventariado } from "../utils/patrimonioId.js";
import { rankTombosForAjuste } from "../utils/ajusteMatch.js";
import { mergeLocaisRecords } from "../services/locaisLoad.js";
import { getAppStyles, COLORS } from "../constants/theme.js";
import { SmartImg } from "../components/SmartImg.jsx";
import { ImageOverlay, Overlay } from "../components/Overlay.jsx";
import { ToastNotification } from "../components/ToastNotification.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { ItemDetailModal } from "../components/ItemDetailModal.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { InventarioPage } from "../pages/InventarioPage.jsx";
import { BuscaPage } from "../pages/BuscaPage.jsx";
import { ItensPage } from "../pages/ItensPage.jsx";
import { NotasFiscaisPage } from "../pages/NotasFiscaisPage.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useUnidades } from "../hooks/useUnidades.js";
import { useLocais } from "../hooks/useLocais.js";
import { useFound } from "../hooks/useFound.js";
import { useInventario } from "../hooks/useInventario.js";
import { useCampanha } from "../hooks/useCampanha.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";
import { useFinalizacoes } from "../hooks/useFinalizacoes.js";
import { FinalizadosPage } from "../pages/FinalizadosPage.jsx";
import { buildFinalizacaoStats, criarFinalizacao, registrarEdicaoFinalizacao, atualizarStatsFinalizacao } from "../services/finalizacoes.js";

const tabFallback = (
  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>Carregando aba…</div>
);
const LazyTombosPage = React.lazy(() => import("../pages/TombosPage.jsx").then((m) => ({ default: m.TombosPage })));
const LazyDashboardPage = React.lazy(() => import("../pages/DashboardPage.jsx").then((m) => ({ default: m.DashboardPage })));
const LazyCoordenadoresTab = React.lazy(() => import("./CoordenadoresTab.jsx").then((m) => ({ default: m.CoordenadoresTab })));
const LazyInventariantesTab = React.lazy(() => import("./InventariantesTab.jsx").then((m) => ({ default: m.InventariantesTab })));

function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

function buildManualPatrimonio(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return { id: `MAN_${Date.now()}`, patrimonioLabel: null };

  const upper = raw.toUpperCase();
  if (upper === "S/T" || upper === "ST" || upper === "SEM TOMBAMENTO") {
    return { id: `ST_${Date.now()}`, patrimonioLabel: "S/T" };
  }

  return {
    id: raw.replaceAll("/", "-"),
    patrimonioLabel: raw,
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
  const [cameraTarget, setCameraTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hideFound, setHideFound] = useState(true);
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
  const [finalizadoEdit, setFinalizadoEdit] = useState(null);

  const formRef = useRef({});
  const manualPatrimonioRef = useRef(null);
  const resumeRestoredRef = useRef(false);
  const cameraTargetRef = useRef(null);

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

  const sessionLocais = useMemo(
    () =>
      filterLocaisForSession(
        locais.locais,
        editScopeSessionId,
        editScopeUnits.map((u) => u.id),
        found.foundMap
      ),
    [locais.locais, editScopeSessionId, editScopeUnits, found.foundMap]
  );

  const createSessionLocal = React.useCallback(
    async (nome, desc = "") => {
      const unitIds = editScopeUnits.map((u) => u.id);
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
          unidadeIds: unitIds,
        },
        { updateQueueStatus }
      );
    },
    [editScopeSessionId, editScopeUnits, inventario.sessionId, locais.createLocal, showT, updateQueueStatus]
  );

  const loadAfterAuth = React.useCallback(async () => {
    await loadXlsx(false);
    await Promise.all([found.loadFoundAndTombos([], { cacheOnly: true }), locais.loadLocais([], { cacheOnly: true })]);
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
          .filter((f) => f?.localId && (!f.unidadeId || ids.includes(f.unidadeId)))
          .map((f) => f.localId)
      ),
    ];
    found.loadFoundAndTombos(ids, {
      keepItemIds,
      itemUnits,
      patrimonioIds: keepItemIds,
    });
    locais.loadLocais(ids, { localIds });
  }, [
    auth.logado,
    finalizadoEdit?.fin?.id,
    inventario.unidadesAtivas.map((u) => u.id).join(","),
    inventario.unidadesAtivas.length,
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
      pingInventoryPresence({
        uid: auth.logado.uid,
        nome: auth.logado.nome,
        email: auth.logado.email,
        unidadeIds: unitIds,
      }).catch(() => {});
    };

    ping();
    const pingTimer = setInterval(ping, 45000);
    const teamTimer = setInterval(async () => {
      try {
        const others = await loadActiveInventors(unitIds, { excludeUid: auth.logado.uid });
        setTeamOnline(others);
      } catch {}
    }, 30000);
    loadActiveInventors(unitIds, { excludeUid: auth.logado.uid }).then(setTeamOnline).catch(() => {});

    return () => {
      clearInterval(pingTimer);
      clearInterval(teamTimer);
      clearInventoryPresence(auth.logado.uid).catch(() => {});
    };
  }, [auth.logado?.uid, auth.logado?.nome, auth.logado?.email, activeUnitIds.join(","), inventario.invSubTab, inventario.unidadesAtivas.length]);

  useEffect(() => {
    if (!auth.logado) return;
    const paused = inventario.invSubTab === "inventariar" && inventario.unidadesAtivas.length > 0;
    if (!paused) updateQueueStatus();

    const onInventarioChange = paused
      ? null
      : async (docs) => {
          const incoming = docs.map((d) => normalizeFoundRecord({ ...d, patrimonioId: d.patrimonioId || d._id }));
          const prev = found.foundRef.current || [];
          const scopeItems =
            inventario.unidadesAtivas.length > 0
              ? inventario.allItens
              : unidades.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome })));
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

    const unsub = setupRealtimeSync(
      activeUnitIds.length ? activeUnitIds : unidadeAtiva?.id,
      onInventarioChange,
      async (docs) => {
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
      },
      null,
      { inventarioMs: 45000, locaisMs: 90000 }
    );

    return () => {
      unsub?.();
    };
  }, [
    auth.logado,
    activeUnitIds.join(","),
    unidadeAtiva?.id,
    inventario.invSubTab,
    inventario.unidadesAtivas.length,
    inventario.allItens.length,
    unidades.length,
    updateQueueStatus,
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

  const sugestoes = React.useMemo(() => {
    const base =
      inventario.unidadesAtivas.length > 0
        ? inventario.unidadesAtivas.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeNome: u.nome, unidadeId: u.id })))
        : todosItens.slice(0, 800);
    return gerarTodasSugestoes(base);
  }, [inventario.unidadesAtivas, todosItens]);

  const tombosDup = React.useMemo(
    () => detectTombosDuplicados(todosItens, found.found),
    [todosItens, found.found]
  );

  const parseNFDate = parseBrDate;

  const nfDataMap = React.useMemo(() => {
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
  }, [todosItens]);
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

  const filtered = React.useMemo(() => {
    const s = search.toLowerCase();
    return inventario.allItens.filter((i) => {
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
  }, [inventario.allItens, hideFound, found.foundSet, found.foundMap, search]);
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
    ...(isAdmin ? [{ id: "inventariantes", l: "Inventariantes" }] : []),
  ];

  useEffect(() => {
    if (!canGerirCoord && tab === "coordenadores") setTab("inventario");
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

  const openDetModal = (item, forceLocalId) => {
    const f = getFoundEntry(item.id, found.foundMap);
    const estadoDefault = f?.estado || defaultEstadoForItem(item);
    formRef.current = {
      detItem: item,
      detEstado: estadoDefault,
      detSituacao: f?.situacao || "Em uso",
      detLocal: typeof forceLocalId === "string" ? forceLocalId : f?.localId || "",
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
    const next = sortedFiltered.find((i) => !isItemInventariado(i.id, found.foundSet));
    if (!next) {
      showT("Nenhum item pendente nos filtros atuais");
      return;
    }
    openDetModal(next);
  }, [sortedFiltered, found.foundSet, showT]);

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
      detLocal: fs.detLocal || f?.localId || "",
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
    };
  };

  const onCameraCapture = async (photoArray) => {
    const resume = loadUiResume();
    const target = cameraTargetRef.current || resume?.cameraTarget || "detalhe";
    ensureDetFormFromResume(resume);

    if (target === "manual") {
      revokeBlobUrls(formRef.current.manPhotos || []);
      formRef.current.manPhotos = photoArray || [];
    } else if (target === "semTombo") {
      revokeBlobUrls(formRef.current.stPhotos || []);
      formRef.current.stPhotos = photoArray || [];
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("semTombo");
      bumpFt();
      return;
    } else {
      revokeBlobUrls(formRef.current.detNewBase64 || []);
      formRef.current.detNewBase64 = photoArray || [];
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
        detLocal: fs.detLocal || f?.localId || "",
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
      };

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
    [unidades, found.foundMap, inventario]
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
    if (!auth.logado || resumeRestoredRef.current) return;
    tryRestoreUi();
  }, [auth.logado, unidades, found.foundMap, tryRestoreUi]);

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
      if (existingIds.has(id)) {
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
      data: new Date().toLocaleDateString("pt-BR"),
      especie: getField("manEspecie") || desc.split(" ")[0].toUpperCase(),
      descricao: desc.trim(),
      marca: getField("manMarca"),
      fornecedor: getField("manFornecedor"),
      empenho: "",
      nf: "",
      dataNF: "",
      valor: parseFloat(getField("manValor")) || 0,
      valorAtual: 0,
      isManual: true,
    };

    const newItems = ids.map((id) => ({ ...baseItem, id }));
    const manLocalId = getField("manLocal") || sessionLocais[0]?.id || "";
    const manEstado = getField("manEstado") || "Bom";
    const manSituacao = getField("manSituacao") || "Em uso";
    const manOrigem = getField("manOrigem") || "Próprio";
    const manMarca = getField("manMarca") || "";

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
        fotoUrls: urls,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: auth.logado?.nome || "",
        email: auth.logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        user: auth.logado?.nome || "",
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
      for (const it of newItems) {
        await found.markFound({
          itemId: it.id,
          estado: manEstado,
          situacao: manSituacao,
          localId: manLocalId,
          obs: desc.trim(),
          marca: manMarca,
          origem: manOrigem,
          fotoUrls: [],
          unidadeAtiva,
          logado: auth.logado,
          localOnly: true,
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

    for (const it of newItems) {
      const created = await found.markFound({
        itemId: it.id,
        estado: getField("manEstado") || "Bom",
        situacao: getField("manSituacao") || "Em uso",
        localId: getField("manLocal") || sessionLocais[0]?.id || "",
        obs: desc.trim(),
        marca: getField("manMarca"),
        origem: getField("manOrigem") || "Próprio",
        fotoUrls,
        unidadeAtiva,
        logado: auth.logado,
      });
      await logAuditoria("create", "manuais", it.id, null, { ...it, unidadeId: unidadeAtiva?.id, fotoUrls, inventario: created });
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
      especie: desc.split(" ")[0].toUpperCase().slice(0, 40),
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

    const stExtras = {
      semTombo: true,
      identificadoPorFoto: true,
      descricaoEdit: desc,
      tomboReferencia: String(getField("stTomboRef") || "").trim(),
      marca: String(getField("stMarca") || "").trim(),
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
        origem: "Próprio",
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
      await found.markFound({
        itemId: id,
        estado: stEstado,
        situacao: "Em uso",
        localId,
        obs: stObs,
        marca: stExtras.marca || "",
        origem: "Próprio",
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

    await found.markFound({
      itemId: id,
      estado: stEstado,
      situacao: "Em uso",
      localId,
      obs: stObs,
      marca: stExtras.marca || "",
      origem: "Próprio",
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
    setModal(null);
    showT(`Finalizado! ${pendentes.length} não encontrado(s)`);
  };

  const finalizarComCoordenadora = async () => {
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

    setModal("qrcode-resultado");
    showT("Convite criado! A coordenadora se cadastra pelo QR Code e você aprova em Coordenadores.");
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
          <InventarioPage
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
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            totalFound={inventario.totalFound}
            totalBens={inventario.totalBens}
            progresso={inventario.progresso}
            filtered={filtered}
            paged={paged}
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            search={search}
            setSearch={setSearch}
            hideFound={hideFound}
            setHideFound={setHideFound}
            openDetModal={openDetModal}
            onOpenManual={(localId) => {
              formRef.current = {
                manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
                manPatrimonio: "",
                manLocal: String(localId || ""),
                manQtd: 1,
                manSharePhotos: true,
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
            onQuickAddLocal={async (nome) => {
              const entry = await createSessionLocal(nome);
              if (entry) showT("Local da sessão adicionado");
            }}
            onDeleteLocal={async (l) => {
              await locais.deleteLocal(l, { updateQueueStatus });
              showT("Local removido");
            }}
            showT={showT}
            onViewImage={onViewImage}
          />
        )}

        {tab === "finalizados" && (
          <FinalizadosPage
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
            onDeleteLocal={async (l) => {
              await locais.deleteLocal(l, { updateQueueStatus });
              showT("Local removido");
            }}
            onViewImage={onViewImage}
            campanhaFechada={campanhaState.fechada}
            logado={auth.logado}
          />
        )}

        {tab === "busca" && (
          <BuscaPage
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
        )}

        {tab === "itens" && (
          <ItensPage
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
        )}

        {tab === "nf" && (
          <NotasFiscaisPage
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

        {tab === "coordenadores" && (
          <Suspense fallback={tabFallback}>
            <LazyCoordenadoresTab unidades={unidades} showT={showT} isMob={isMob} />
          </Suspense>
        )}
        {tab === "inventariantes" && (
          <Suspense fallback={tabFallback}>
            <LazyInventariantesTab showT={showT} isMob={isMob} />
          </Suspense>
        )}
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
          onClose={() => { revokeBlobUrls(formRef.current.detNewBase64 || []); clearUiResume(); setModal(null); }}
        >
          <ItemDetailModal
            item={formRef.current.detItem}
            foundEntry={getFoundEntry(formRef.current.detItem.id, found.foundMap)}
            foundSet={found.foundSet}
            locais={sessionLocais.length > 0 ? sessionLocais : locais.locais}
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
            onClose={() => { revokeBlobUrls(formRef.current.detNewBase64 || []); clearUiResume(); setModal(null); }}
            onSave={() => {
              if (!assertPodeEditar()) return;
              found.saveDetail({
                formRef,
                getField,
                unidadeAtiva: resolveItemUnit(formRef.current.detItem),
                itemUnit: resolveItemUnit(formRef.current.detItem),
                logado: auth.logado,
                updateQueueStatus,
                closeModal: () => { revokeBlobUrls(formRef.current.detNewBase64 || []); clearUiResume(); setModal(null); },
              });
            }}
            onDelete={async () => {
              await found.deleteFound(formRef.current.detItem.id);
              revokeBlobUrls(formRef.current.detNewBase64 || []);
              setModal(null);
              showT("Removido");
            }}
          />
        </Overlay>
      )}

      {modal === "manual" && (
        <Overlay
          isMobile={isMob}
          suppressBackdropMs={isMob ? Math.max(overlayBackdropSuppressMs, 400) : overlayBackdropSuppressMs}
          onClose={() => { revokeBlobUrls(formRef.current.manPhotos || []); clearUiResume(); setModal(null); }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Adicionar Manual</h2>
            <button onClick={() => { revokeBlobUrls(formRef.current.manPhotos || []); clearUiResume(); setModal(null); }} style={{ background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Fechar
            </button>
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Descrição *</label>
          <TInput
            key={"manDesc_" + ft}
            initial={getField("manDesc")}
            onVal={(v) => {
              setField("manDesc", v);
              if (!String(getField("manEspecie") || "").trim()) {
                setField("manEspecie", inferEspecieFromDesc(v, sugestoes.especies));
                bumpFt();
              }
            }}
            placeholder="Descreva o item..."
            suggestions={sugestoes.descricoes}
            style={inp}
          />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Nº do Patrimônio</label>
          <input
            ref={manualPatrimonioRef}
            key={"manPat_" + ft}
            defaultValue={getField("manPatrimonio")}
            onChange={(e) => setField("manPatrimonio", e.target.value)}
            placeholder="Digite o patrimônio ou S/T"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            style={inp}
          />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Quantidade</label>
          <input
            key={"manQtd_" + ft}
            defaultValue={String(formRef.current.manQtd || 1)}
            onChange={(e) => {
              const n = Math.max(1, Math.min(50, Math.floor(Number(e.target.value || 1) || 1)));
              formRef.current.manQtd = n;
              bumpFt();
            }}
            type="number"
            min={1}
            max={50}
            step={1}
            inputMode="numeric"
            style={inp}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
            Para economizar fotos no Firebase, uma mesma foto pode ser aplicada a todos os itens desta quantidade.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 2 }}>
            <button
              onClick={() => {
                formRef.current.manPatrimonio = "S/T";
                if (manualPatrimonioRef.current) {
                  manualPatrimonioRef.current.value = "S/T";
                  manualPatrimonioRef.current.focus();
                }
              }}
              style={{ ...bs, fontSize: 12, padding: "8px 12px" }}
            >
              Marcar S/T
            </button>
            <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>Se deixar em branco, o sistema gera um código automático.</span>
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Espécie</label>
          <TInput key={"manEsp_" + ft} initial={getField("manEspecie")} onVal={(v) => setField("manEspecie", v)} placeholder="Ex: CADEIRA, MESA..." suggestions={sugestoes.especies} style={inp} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Marca</label>
          <TInput key="manMarca" initial={getField("manMarca")} onVal={(v) => setField("manMarca", v)} placeholder="Marca..." suggestions={sugestoes.marcas} style={inp} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Fornecedor</label>
          <TInput key="manForn" initial={getField("manFornecedor")} onVal={(v) => setField("manFornecedor", v)} placeholder="Fornecedor..." suggestions={sugestoes.fornecedores} style={inp} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Valor</label>
          <TInput key="manVal" initial={getField("manValor")} onVal={(v) => setField("manValor", v)} type="number" placeholder="0.00" style={inp} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Origem</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["Próprio", "Doação", "Permuta"].map((o) => (
              <button
                key={o}
                onClick={() => {
                  formRef.current.manOrigem = o;
                  bumpFt();
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `2px solid ${(formRef.current.manOrigem || "Próprio") === o ? "#1351B4" : "#e2e8f0"}`,
                  background: (formRef.current.manOrigem || "Próprio") === o ? "#dbeafe" : "#fff",
                  color: (formRef.current.manOrigem || "Próprio") === o ? "#1351B4" : "#6b7280",
                }}
              >
                {o}
              </button>
            ))}
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Estado de Conservação</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  formRef.current.manEstado = e;
                  bumpFt();
                }}
                style={{
                  padding: "8px 4px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `2px solid ${(formRef.current.manEstado || "Bom") === e ? EC[e].tx : "#e2e8f0"}`,
                  background: (formRef.current.manEstado || "Bom") === e ? EC[e].bg : "#fff",
                  color: (formRef.current.manEstado || "Bom") === e ? EC[e].tx : "#6b7280",
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Situação</label>
          <select key="manSit" defaultValue={getField("manSituacao") || "Em uso"} onChange={(e) => setField("manSituacao", e.target.value)} style={inp}>
            {SITUACOES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Local</label>
          <select key={"manLocal_" + ft} defaultValue={getField("manLocal") || ""} onChange={(e) => { setField("manLocal", e.target.value); bumpFt(); }} style={inp}>
            <option value="">{sessionLocais.length ? "— Selecione —" : "— Crie um local na sessão —"}</option>
            {sessionLocais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Fotos</label>
          {Number(formRef.current.manQtd || 1) > 1 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", fontSize: 12, color: "#334155", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={formRef.current.manSharePhotos !== false}
                onChange={(e) => {
                  formRef.current.manSharePhotos = !!e.target.checked;
                  bumpFt();
                }}
              />
              Usar as mesmas fotos para todos
            </label>
          )}
          {formRef.current.manPhotos?.length > 0 ? (
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {formRef.current.manPhotos.map((ph, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <SmartImg
                      src={ph}
                      alt=""
                      style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, cursor: "zoom-in" }}
                      onClick={() => onViewImage(ph)}
                    />
                    <button
                      onClick={() => {
                        const old = formRef.current.manPhotos?.[i];
                        if (String(old || "").startsWith("blob:")) {
                          try {
                            URL.revokeObjectURL(String(old));
                          } catch {}
                        }
                        formRef.current.manPhotos = formRef.current.manPhotos.filter((_, j) => j !== i);
                        bumpFt();
                      }}
                      style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, fontSize: 9, cursor: "pointer" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => openCamera("manual")} style={{ width: "100%", border: "1.5px dashed #93c5fd", background: "#eff6ff", borderRadius: 8, padding: 8, cursor: "pointer", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
                + Mais fotos
              </button>
            </div>
          ) : (
            <button onClick={() => openCamera("manual")} style={{ width: "100%", border: "2px dashed #cbd5e1", background: "#f8fafc", borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Adicionar fotos</span>
            </button>
          )}
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => { revokeBlobUrls(formRef.current.manPhotos || []); clearUiResume(); setModal(null); }} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button onClick={addManual} style={{ ...bp, flex: 1 }}>
              Criar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "addLocal" && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Novo Local</h2>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Nome *</label>
          <TInput initial="" onVal={(v) => setField("localNome", v)} placeholder="Ex: Sala de Reunião..." style={inp} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Descrição</label>
          <TInput initial="" onVal={(v) => setField("localDesc", v)} placeholder="Andar, ala..." style={inp} />
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button
              onClick={async () => {
                const n = getField("localNome");
                if (!String(n || "").trim()) return;
                await createSessionLocal(n);
                setModal(null);
                showT("Local criado");
              }}
              style={{ ...bp, flex: 1 }}
            >
              Criar
            </button>
          </div>
        </Overlay>
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
          <div style={{ display: "flex", gap: 9 }}>
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
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Finalizar inventário</h2>
            <p style={{ color: "#64748b", margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
              {inventario.unidadesAtivas.length === 1
                ? inventario.unidadesAtivas[0].nome
                : `${inventario.unidadesAtivas.length} unidades em inventário`}
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "#15803d", lineHeight: 1.45, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
              Finalizar encerra a sessão ativa, mas o inventário continua editável na aba <strong>Finalizados</strong> — ajustes, locais e ligação de mobiliário permanecem disponíveis.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#15803d" }}>{inventario.totalFound}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Encontrados</p>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#b91c1c" }}>{inventario.totalBens - inventario.totalFound}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Não encontrados</p>
              </div>
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Dados da coordenadora</p>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#475569" }}>Nome completo</p>
              <TInput initial={getField("coordNome")} onVal={(v) => setField("coordNome", v)} placeholder="Ex: Maria Silva" style={{ ...inp, marginBottom: 10 }} />
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#475569" }}>Matrícula</p>
              <TInput initial={getField("coordMatricula")} onVal={(v) => setField("coordMatricula", v)} placeholder="Ex: 123456" style={inp} />
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
                Será gerado um link e QR Code. A coordenadora se cadastra pelo link; o administrador aprova em Coordenadores.
              </p>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={finalizarComCoordenadora} style={{ ...bp, flex: 1 }}>
                Gerar link e QR Code
              </button>
            </div>
          </div>
        </Overlay>
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
            <img src={qrCodeUrl} alt="QR Code" style={{ width: 240, height: 240, margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: 8 }} />
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
        <Overlay isMobile={isMob} onClose={() => { revokeBlobUrls(formRef.current.stPhotos || []); setModal(null); }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
            {(formRef.current.stMode || "novo") === "pendentes" ? "Mesma foto em vários tombos" : "Foto e descrição (sem tombo)"}
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            {(formRef.current.stMode || "novo") === "pendentes"
              ? "Tire uma foto e marque vários itens pendentes da planilha com ela."
              : "Registre o que encontrou por foto. Depois vincule ao tombo correto na aba Ajuste."}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { id: "novo", label: "Novo sem tombo" },
              { id: "pendentes", label: "Marcar pendentes" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  formRef.current.stMode = m.id;
                  bumpFt();
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 9,
                  border: `2px solid ${(formRef.current.stMode || "novo") === m.id ? "#1351B4" : "#e2e8f0"}`,
                  background: (formRef.current.stMode || "novo") === m.id ? "#dbeafe" : "#fff",
                  color: (formRef.current.stMode || "novo") === m.id ? "#1351B4" : "#64748b",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Local da sessão *</label>
          <select key={"stLoc_" + ft} defaultValue={getField("stLocal")} onChange={(e) => setField("stLocal", e.target.value)} style={inp}>
            <option value="">— Selecione —</option>
            {sessionLocais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Fotos *</label>
          {formRef.current.stPhotos?.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {formRef.current.stPhotos.map((ph, i) => (
                <img key={i} src={ph} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
              ))}
            </div>
          ) : null}
          <button onClick={() => openCamera("semTombo")} style={{ width: "100%", border: "1.5px dashed #cbd5e1", background: "#f8fafc", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 13, color: "#334155", fontWeight: 600, marginBottom: 12 }}>
            {formRef.current.stPhotos?.length ? "Tirar outra foto" : "Tirar foto"}
          </button>

          {(formRef.current.stMode || "novo") === "novo" ? (
            <>
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#92400e", fontWeight: 600 }}>Será marcado como item sem tombo (identificado por foto).</p>
              </div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Nome / descrição do item *</label>
              <TArea key={"stDesc_" + ft} initial={getField("stDesc")} onVal={(v) => setField("stDesc", v)} rows={2} placeholder="Ex: Cadeira giratória preta..." style={{ ...inp, resize: "none" }} />
              {inventario.unidadesAtivas.length > 1 && (
                <>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Unidade</label>
                  <select key={"stUn_" + ft} defaultValue={getField("stUnidadeId")} onChange={(e) => setField("stUnidadeId", e.target.value)} style={inp}>
                    {inventario.unidadesAtivas.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Marca / fornecedor da mobília</label>
              <TInput key={"stMarca_" + ft} initial={getField("stMarca")} onVal={(v) => setField("stMarca", v)} placeholder="Ex: RM MOVEIS" suggestions={sugestoes.marcas} style={inp} />
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Tombamento sugerido (opcional)</label>
              <TInput key={"stRef_" + ft} initial={getField("stTomboRef")} onVal={(v) => setField("stTomboRef", v)} placeholder="Número se souber..." style={inp} />
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>Busque itens pendentes e selecione vários para usar a mesma foto.</p>
              <TInput
                key={"stPendS_" + ft}
                initial={getField("stPendSearch")}
                onVal={(v) => {
                  setField("stPendSearch", v);
                  bumpFt();
                }}
                placeholder="Buscar por tombo, descrição, fornecedor..."
                style={{ ...inp, marginBottom: 8 }}
              />
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, marginBottom: 8 }}>
                {getSemTomboPendentes().slice(0, 40).map((it) => {
                  const sel = (formRef.current.stSelectedIds || []).includes(it.id);
                  return (
                    <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 6px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleStPending(it.id)} style={{ marginTop: 3 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>{it.descricao || it.especie || "—"}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Nº {getItemCode(it)} · {it.fornecedor || "—"}</span>
                      </span>
                    </label>
                  );
                })}
                {getSemTomboPendentes().length === 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 12 }}>Nenhum pendente encontrado.</p>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                Selecionados: {(formRef.current.stSelectedIds || []).length}
              </p>
            </>
          )}

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => { revokeBlobUrls(formRef.current.stPhotos || []); setModal(null); }} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button
              onClick={(formRef.current.stMode || "novo") === "pendentes" ? addSemTomboPendentes : addSemTomboItem}
              style={{ ...bp, flex: 1 }}
            >
              Registrar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "ajusteLink" && formRef.current.ajusteStItem && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>Vincular foto ao tombo</h2>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            Foto/descrição: <strong>{formRef.current.ajusteStItem.descricao || formRef.current.ajusteStFound?.descricaoEdit || "—"}</strong>
          </p>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#92400e" }}>
              Escolha um tombo da planilha que ainda não foi inventariado. A foto será transferida para esse patrimônio.
            </p>
          </div>
          <TInput
            key={"ajS_" + ft}
            initial={getField("ajusteSearch")}
            onVal={(v) => {
              setField("ajusteSearch", v);
              bumpFt();
            }}
            placeholder="Buscar tombo pendente..."
            style={{ ...inp, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
            {(() => {
              const stUnitId = formRef.current.ajusteStItem?.unidadeId || formRef.current.ajusteStFound?.unidadeId;
              const q = String(formRef.current.ajusteSearch || "").trim().toLowerCase();
              const pool = scopeAllItens.filter((i) => {
                if (i.id === formRef.current.ajusteStId) return false;
                if (isSemTomboItem(i, found.foundMap[i.id])) return false;
                if (String(i.id || "").startsWith("ST_") || String(i.id || "").startsWith("MAN_")) return false;
                if (found.foundSet.has(i.id)) return false;
                if (stUnitId && i.unidadeId && i.unidadeId !== stUnitId) return false;
                if (!q) return true;
                return (
                  String(i.id || "").toLowerCase().includes(q) ||
                  String(i.patrimonioLabel || "").toLowerCase().includes(q) ||
                  String(i.descricao || "").toLowerCase().includes(q) ||
                  String(i.especie || "").toLowerCase().includes(q) ||
                  String(i.fornecedor || "").toLowerCase().includes(q) ||
                  String(i.marca || "").toLowerCase().includes(q)
                );
              });
              const ranked = rankTombosForAjuste(formRef.current.ajusteStItem, formRef.current.ajusteStFound, pool, {
                minScore: 0,
                limit: 50,
              });
              const rankedIds = new Set(ranked.map((r) => r.item.id));
              const rest = pool.filter((i) => !rankedIds.has(i.id));
              const candidates = [...ranked.map((r) => ({ ...r.item, _match: r })), ...rest.map((item) => ({ ...item, _match: null }))].slice(0, 40);
              if (!candidates.length) {
                return <p style={{ margin: 0, padding: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Nenhum tombo pendente encontrado.</p>;
              }
              return candidates.map((it) => {
                const sel = formRef.current.ajusteRealId === it.id;
                const match = it._match;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      formRef.current.ajusteRealId = it.id;
                      bumpFt();
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: "1px solid #f1f5f9",
                      background: sel ? "#eff6ff" : match?.score >= 40 ? "#f0fdf4" : "#fff",
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 700, flex: 1 }}>{it.descricao || it.especie || "—"}</span>
                      {match?.score >= 15 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: match.score >= 60 ? "#15803d" : "#1d4ed8", flexShrink: 0 }}>
                          {match.score}% · {match.reasons?.join(", ")}
                        </span>
                      )}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      Nº {it.patrimonioLabel || it.id} · {it.fornecedor || "—"}
                      {it.marca ? ` · Marca: ${it.marca}` : ""}
                    </span>
                  </button>
                );
              });
            })()}
          </div>
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>Cancelar</button>
            <button onClick={linkSemTomboToTombo} style={{ ...bp, flex: 1 }}>Vincular</button>
          </div>
        </Overlay>
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
