import React, { useEffect, useRef, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, PER_PAGE, SC, SITUACOES } from "../constants/inventory.js";
import { clearFirebaseSession, fsDel, fsGetAll, fsSet, isFirebaseConfigured, setFirebaseSession, fbLogin, fbRegister, refreshAuthToken, obterInventariantePorUid } from "../services/firebase.js";
import { getDisplayPhotoUrl, uploadPhotos, isStorageOk, deletePhoto } from "../services/storage.js";
import { generateCoordinadorLink, generateCoordinadorToken, generateQRCode } from "../services/qr-service.js";
import { criarBackupManual, logAuditoria, setupRealtimeSync } from "../services/audit.js";
import { EVENTOS, gerarRelatorioExcel, gerarRelatorioPDF, notificationService, offlineManager } from "../services/features.js";
import { CATEGORY_TREE, getCategoryGroup, getSubcategoryLabel } from "./categories.js";
import { compressPhotoArray, getCachedData, perfMonitor, setCachedData } from "../utils/performance.js";
import { loadUnidades } from "../utils/xlsx.js";
import { gerarTodasSugestoes } from "../utils/suggestions.js";
import { CoordenadoresTab } from "./CoordenadoresTab.jsx";
import { InventariantesTab } from "./InventariantesTab.jsx";
import { Overlay } from "../components/Overlay.jsx";
import { ToastNotification } from "../components/ToastNotification.jsx";
import { NavBar } from "../components/NavBar.jsx";
import { ItemDetailModal } from "../components/ItemDetailModal.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { InventarioPage } from "../pages/InventarioPage.jsx";
import { BuscaPage } from "../pages/BuscaPage.jsx";
import { ItensPage } from "../pages/ItensPage.jsx";
import { NotasFiscaisPage } from "../pages/NotasFiscaisPage.jsx";
import { TombosPage } from "../pages/TombosPage.jsx";
import { DashboardPage } from "../pages/DashboardPage.jsx";
import { LocaisPage } from "../pages/LocaisPage.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useUnidades } from "../hooks/useUnidades.js";
import { useLocais } from "../hooks/useLocais.js";
import { useFound } from "../hooks/useFound.js";
import { useInventario } from "../hooks/useInventario.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";

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

function SmartImg({ src, alt = "", style, ...rest }) {
  const [resolved, setResolved] = useState(src || "");
  useEffect(() => {
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
  const [cameraTarget, setCameraTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tombosTab, setTombosTab] = useState("ne");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [nfSearch, setNfSearch] = useState("");
  const [nfTipo, setNfTipo] = useState("Todos");
  const [nfPage, setNfPage] = useState(1);
  const [ft, setFt] = useState(0);

  const formRef = useRef({});
  const manualPatrimonioRef = useRef(null);

  const bumpFt = () => setFt((t) => t + 1);
  const setField = (k, v) => {
    formRef.current[k] = v;
  };
  const getField = (k) => formRef.current[k] || "";

  const showT = React.useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
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
  const unidadeAtiva = inventario.unidadesAtivas[0] || null;

  const loadAfterAuth = React.useCallback(async () => {
    await Promise.all([loadXlsx(false), found.loadFoundAndTombos(), locais.loadLocais()]);
  }, [loadXlsx, found.loadFoundAndTombos, locais.loadLocais]);

  const auth = useAuth({ firebaseOk, loadAfterAuth, showT });

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

  useEffect(() => {
    if (!auth.logado) return;
    updateQueueStatus();

    const unsub = setupRealtimeSync(
      unidadeAtiva?.id,
      async (docs) => {
        const nextFound = docs.map((d) => ({ ...d, patrimonioId: d.patrimonioId || d._id }));
        const prev = found.foundRef.current || [];
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
      },
      async (docs) => {
        const nextLocais = docs.map((d) => ({ ...d, id: d._id }));
        const prev = locais.locaisRef.current || [];
        let same = prev.length === nextLocais.length;
        if (same) {
          const prevMap = new Map(prev.map((p) => [p.id || p._id, String(p.nome || "")]));
          same = prevMap.size === nextLocais.length;
          if (same) {
            for (const n of nextLocais) {
              const id = n.id || n._id;
              if (prevMap.get(id) !== String(n.nome || "")) {
                same = false;
                break;
              }
            }
          }
        }
        if (!same) {
          locais.setLocais(nextLocais);
          await setCachedData("locais", nextLocais);
        }
      },
      null
    );

    return () => {
      unsub?.();
    };
  }, [auth.logado, unidadeAtiva?.id, updateQueueStatus, found.setFound, found.foundRef, locais.setLocais, locais.locaisRef]);

  const renderOfflineStatus = () => {
    if (queueStatus.isOnline && queueStatus.pending === 0 && queueStatus.failed === 0) {
      return <span style={{ fontSize: 12, color: "#dcfce7", fontWeight: 700 }}>📡 Online</span>;
    }

    if (!queueStatus.isOnline) {
      return (
        <span style={{ fontSize: 12, color: "#fef3c7", fontWeight: 700 }}>
          📴 Offline · {queueStatus.pending} pendente{queueStatus.pending !== 1 ? "s" : ""}
        </span>
      );
    }

    return (
      <span style={{ fontSize: 12, color: "#fde68a", fontWeight: 700 }}>
        ⏳ Fila {queueStatus.pending} pendente{queueStatus.pending !== 1 ? "s" : ""}{queueStatus.failed ? ` · ${queueStatus.failed} falha(s)` : ""}
      </span>
    );
  };

  const todosItens = React.useMemo(() => unidades.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeNome: u.nome, unidadeId: u.id }))), [unidades]);
  const sugestoes = React.useMemo(() => gerarTodasSugestoes(todosItens), [todosItens]);

  const parseNFDate = (s) => {
    if (!s) return new Date(0);
    const parts = String(s).split("/");
    if (parts.length !== 3) return new Date(0);
    const [d, m, y] = parts;
    return new Date(+y, +m - 1, +d);
  };

  const nfDataMap = {};
  for (const item of todosItens) {
    const nf = (item.nf || "").trim();
    if (!nf) continue;
    if (!nfDataMap[nf]) {
      nfDataMap[nf] = {
        nf,
        dataNF: item.dataNF || "",
        fornecedor: item.fornecedor || "",
        tipoEntrada: item.tipoEntrada || "Próprio",
        itens: [],
        valorTotal: 0,
        valorAtualTotal: 0,
      };
    }
    nfDataMap[nf].itens.push(item);
    nfDataMap[nf].valorTotal += Number(item.valor || 0) || 0;
    nfDataMap[nf].valorAtualTotal += Number(item.valorAtual || 0) || 0;
    if (!nfDataMap[nf].dataNF && item.dataNF) nfDataMap[nf].dataNF = item.dataNF;
    if (!nfDataMap[nf].fornecedor && item.fornecedor) nfDataMap[nf].fornecedor = item.fornecedor;
    if (!nfDataMap[nf].tipoEntrada && item.tipoEntrada) nfDataMap[nf].tipoEntrada = item.tipoEntrada;
  }
  const nfDataList = Object.values(nfDataMap).sort((a, b) => parseNFDate(b.dataNF) - parseNFDate(a.dataNF));
  const NF_PER_PAGE = 15;

  const xlsxCorrompidos = todosItens.filter((i) => {
    const noText = !String(i.descricao || "").trim() && !String(i.especie || "").trim() && !String(i.fornecedor || "").trim() && !String(i.marca || "").trim();
    const noNums = !(Number(i.valor || 0) || 0) && !(Number(i.valorAtual || 0) || 0);
    const noDocs = !String(i.nf || "").trim() && !String(i.dataNF || "").trim() && !String(i.empenho || "").trim();
    const noDate = !String(i.data || "").trim();
    return noText && noNums && noDocs && noDate;
  });

  const filtered = inventario.allItens.filter((i) => {
    const s = search.toLowerCase();
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
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const origemMeta = {
    Próprio: { bg: "#dbeafe", tx: "#1d4ed8", ico: "🏛️" },
    Doação: { bg: "#fef3c7", tx: "#92400e", ico: "🎁" },
    Incorporado: { bg: "#d1fae5", tx: "#065f46", ico: "📋" },
    Permuta: { bg: "#ede9fe", tx: "#6d28d9", ico: "🔄" },
  };

  const inp = { width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
  const bp = { background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
  const bs = { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const cd = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

  const isAdmin = auth.logado?.role === "admin";
  const navs = [
    { id: "inventario", icon: "📦", l: "Inventário", badge: inventario.unidadesAtivas.length > 0 ? inventario.unidadesAtivas.length : null },
    { id: "busca", icon: "🔍", l: "Busca" },
    { id: "itens", icon: "🪑", l: "Itens" },
    { id: "nf", icon: "🧾", l: "Notas" },
    { id: "tombos", icon: "🔖", l: "Tombos" },
    { id: "dash", icon: "📊", l: "Dashboard" },
    { id: "locais", icon: "📍", l: "Locais" },
    ...(isAdmin
      ? [
          { id: "coordenadores", icon: "👩‍💼", l: "Coordenadores" },
          { id: "inventariantes", icon: "👷", l: "Inventariantes" },
        ]
      : []),
  ];

  useEffect(() => {
    if (!isAdmin && (tab === "coordenadores" || tab === "inventariantes")) setTab("inventario");
  }, [isAdmin, tab]);

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

  const openDetModal = (item) => {
    const f = found.foundMap[item.id];
    formRef.current = {
      detItem: item,
      detEstado: f?.estado || "Bom",
      detSituacao: f?.situacao || "Em uso",
      detLocal: f?.localId || "",
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
    };
    bumpFt();
    setModal("detalhe");
  };

  const openCamera = (target) => {
    setCameraTarget(target);
    setModal("camera");
  };

  const onCameraCapture = (photoArray) => {
    if (cameraTarget === "manual") {
      formRef.current.manPhotos = photoArray;
      setCameraTarget(null);
      setModal("manual");
    } else {
      formRef.current.detNewBase64 = [...(formRef.current.detNewBase64 || []), ...photoArray];
      setCameraTarget(null);
      setModal("detalhe");
    }
    bumpFt();
  };

  const addManual = async () => {
    const desc = getField("manDesc");
    if (!desc.trim()) {
      showT("Descrição obrigatória");
      return;
    }
    if (!unidadeAtiva) {
      showT("Selecione uma unidade");
      return;
    }
    const manualPatrimonio = buildManualPatrimonio(getField("manPatrimonio"));
    const id = manualPatrimonio.id;

    if ((unidadeAtiva?.itens || []).some((i) => i.id === id)) {
      showT("Já existe um item com esse patrimônio nesta unidade");
      return;
    }

    const item = {
      id,
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

    await fsSet("manuais", id, { ...item, unidadeId: unidadeAtiva?.id });

    let fotoUrls = [];
    if (formRef.current.manPhotos?.length && isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.manPhotos);
        fotoUrls = await uploadPhotos(compressed, id);
      } catch {} finally {
        setBusy(false);
      }
    }

    const novaAtiva = { ...unidadeAtiva, itens: [...unidadeAtiva.itens, item] };
    inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));

    const created = await found.markFound({
      itemId: id,
      estado: getField("manEstado") || "Bom",
      situacao: getField("manSituacao") || "Em uso",
      localId: locais.locais[0]?.id || "",
      obs: desc.trim(),
      marca: getField("manMarca"),
      origem: getField("manOrigem") || "Próprio",
      fotoUrls,
      unidadeAtiva,
      logado: auth.logado,
    });
    await logAuditoria("create", "manuais", id, null, { ...item, unidadeId: unidadeAtiva?.id, fotoUrls, inventario: created });
    setModal(null);
    showT("✓ Item adicionado!");
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
      showT(`✓ Relatório em ${formato.toUpperCase()} gerado`);
    } catch {
      showT("⚠️ Erro ao gerar relatório");
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
      showT(`✓ Backup criado (${(backup.tamanho / 1024).toFixed(0)}KB)`);
    } catch {
      showT("⚠️ Erro ao criar backup");
    } finally {
      setBusy(false);
    }
  };

  const finalizarInv = async () => {
    const pendentes = inventario.allItens.filter((i) => !found.foundSet.has(i.id));
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
    if (!unidadeAtiva?.id) return;

    const token = generateCoordinadorToken(unidadeAtiva.id);
    const link = generateCoordinadorLink(token);
    const qrUrl = await generateQRCode(link);
    setQrCodeUrl(qrUrl);

    const coordDoc = {
      token,
      unidadeId: unidadeAtiva.id,
      unidadeNome: unidadeAtiva.nome,
      coordenadoraNome: nome,
      coordenadoraMatricula: matricula,
      criadoEm: new Date().toISOString(),
      ativa: true,
      link,
    };
    await fsSet("coordenadores", token, coordDoc);

    const pendentes = inventario.allItens.filter((i) => !found.foundSet.has(i.id));
    const dataFin = new Date().toLocaleDateString("pt-BR");
    for (const item of pendentes) {
      const ne = { patrimonioId: item.id, descricao: item.descricao, especie: item.especie, unidade: item.unidadeNome, dataFin, coordenadora: nome, matricula };
      await fsSet("tombosNE", item.id, ne);
    }
    found.setTombosNE((prev) => [...prev, ...pendentes.map((i) => ({ ...i, unidade: i.unidadeNome, dataFin, coordenadora: nome, matricula }))]);

    setModal("qrcode-resultado");
    showT("✓ Coordenadora cadastrada! QR Code gerado");
  };

  if (auth.loading || busy)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f1f5f9", gap: 16 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#1e3a8a", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 13 }}>Carregando inventário...</p>
      </div>
    );

  if (!auth.logado)
    return (
      <LoginPage
        firebaseOk={firebaseOk}
        isProd={isProd}
        loginMode={auth.loginMode}
        loginError={auth.loginError}
        onEmail={(v) => setField("email", v)}
        onSenha={(v) => setField("senha", v)}
        onSubmit={() => auth.login(getField("email"), getField("senha"))}
        onToggleMode={() => {
          auth.setLoginMode((m) => (m === "login" ? "register" : "login"));
          auth.setLoginError("");
        }}
        inp={inp}
        bp={bp}
      />
    );

  const banner =
    found.uploading && (
      <div style={{ background: "#1e40af", color: "#fff", padding: "8px 16px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>
        ☁️ {found.uploadMsg || "Enviando fotos..."}
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
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
            setSearch={setSearch}
            openDetModal={openDetModal}
            onOpenManual={() => {
              formRef.current = { manEstado: "Bom", manPatrimonio: "" };
              bumpFt();
              setModal("manual");
            }}
            onOpenFinalizar={() => setModal("finalizar")}
            onOpenCancelar={() => setModal("cancelar-inventario")}
            locais={locais.locais}
            onQuickAddLocal={async (nome) => {
              await locais.createLocal({ nome });
              showT("✓ Local adicionado!");
            }}
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

        {tab === "tombos" && <TombosPage tombosNE={found.tombosNE} tombosDup={found.tombosDup} tombosTab={tombosTab} setTombosTab={setTombosTab} isMob={isMob} bp={bp} bs={bs} cd={cd} />}

        {tab === "dash" && (
          <DashboardPage
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
          />
        )}

        {tab === "coordenadores" && <CoordenadoresTab unidades={unidades} showT={showT} isMob={isMob} />}
        {tab === "inventariantes" && <InventariantesTab showT={showT} isMob={isMob} />}

        {tab === "locais" && (
          <LocaisPage
            locais={locais.locais}
            found={found.found}
            onNew={() => {
              formRef.current = {};
              setModal("addLocal");
            }}
            onDelete={async (l) => {
              await locais.deleteLocal(l);
            }}
            showT={showT}
            isMob={isMob}
            bp={bp}
            cd={cd}
          />
        )}
      </NavBar>

      {modal === "camera" && (
        <CameraModal
          existingPhotos={cameraTarget === "manual" ? formRef.current.manPhotos || [] : formRef.current.detNewBase64 || []}
          onCapture={onCameraCapture}
          onClose={() => {
            setCameraTarget(null);
            setModal(cameraTarget === "manual" ? "manual" : formRef.current.detItem ? "detalhe" : null);
          }}
        />
      )}

      {modal === "detalhe" && formRef.current.detItem && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <ItemDetailModal
            item={formRef.current.detItem}
            foundEntry={found.foundMap[formRef.current.detItem.id]}
            foundSet={found.foundSet}
            locais={locais.locais}
            origemMeta={origemMeta}
            isMobile={isMob}
            ft={ft}
            bumpFt={bumpFt}
            formRef={formRef}
            setField={setField}
            getField={getField}
            sugestoes={sugestoes}
            onOpenCamera={openCamera}
            onClose={() => setModal(null)}
            onSave={() =>
              found.saveDetail({
                formRef,
                getField,
                unidadeAtiva: unidadeAtiva || { id: formRef.current.detItem.unidadeId, nome: formRef.current.detItem.unidadeNome },
                logado: auth.logado,
                updateQueueStatus,
                closeModal: () => setModal(null),
              })
            }
            onDelete={async () => {
              await found.deleteFound(formRef.current.detItem.id);
              setModal(null);
              showT("Removido");
            }}
          />
        </Overlay>
      )}

      {modal === "manual" && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Adicionar Manual</h2>
            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Descrição *</label>
          <TArea key="manDesc" initial={getField("manDesc")} onVal={(v) => setField("manDesc", v)} rows={3} placeholder="Descreva o item..." style={{ ...inp, resize: "none" }} />
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
                  border: `2px solid ${(formRef.current.manOrigem || "Próprio") === o ? "#1e3a8a" : "#e2e8f0"}`,
                  background: (formRef.current.manOrigem || "Próprio") === o ? "#dbeafe" : "#fff",
                  color: (formRef.current.manOrigem || "Próprio") === o ? "#1e3a8a" : "#6b7280",
                }}
              >
                {o === "Próprio" ? "🏛️ Próprio" : o === "Doação" ? "🎁 Doação" : "🔄 Permuta"}
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
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Fotos</label>
          {formRef.current.manPhotos?.length > 0 ? (
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {formRef.current.manPhotos.map((ph, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <SmartImg src={ph} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6 }} />
                    <button
                      onClick={() => {
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
              <span style={{ fontSize: 28 }}>📷</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>Abrir câmera</span>
            </button>
          )}
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button onClick={addManual} style={{ ...bp, flex: 1 }}>
              ✓ Criar
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
                await locais.createLocal({ nome: n, desc: getField("localDesc") });
                setModal(null);
                showT("✓ Local criado!");
              }}
              style={{ ...bp, flex: 1 }}
            >
              Criar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "finalizar" && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 48, margin: "0 0 16px" }}>⚠️</p>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Finalizar Inventário</h2>
            <p style={{ color: "#64748b", margin: "0 0 20px" }}>{inventario.unidadesAtivas.length === 1 ? inventario.unidadesAtivas[0].nome : `${inventario.unidadesAtivas.length} unidades selecionadas`}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#16a34a" }}>{inventario.totalFound}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Encontrados</p>
              </div>
              <div style={{ background: "#fef2f2", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#dc2626" }}>{inventario.totalBens - inventario.totalFound}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Não encontrados</p>
              </div>
            </div>
            <div style={{ background: "#f9f3ff", border: "1.5px solid #e9d5ff", borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left" }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#6b21a8" }}>📋 Dados da Coordenadora</p>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Nome completo *</p>
              <TInput initial={getField("coordNome")} onVal={(v) => setField("coordNome", v)} placeholder="Ex: Maria Silva..." style={{ ...inp, marginBottom: 10 }} />
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Matrícula *</p>
              <TInput initial={getField("coordMatricula")} onVal={(v) => setField("coordMatricula", v)} placeholder="Ex: 123456..." style={inp} />
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={finalizarComCoordenadora} style={{ ...bp, flex: 1, background: "#16a34a" }}>
                ✓ Gerar QR Code
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
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 16px" }}>📱</p>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>QR Code Gerado</h2>
            <p style={{ color: "#64748b", margin: "0 0 16px", fontSize: 13 }}>
              {getField("coordNome")} • {getField("coordMatricula")}
            </p>
            <img src={qrCodeUrl} alt="QR Code" style={{ width: 280, height: 280, margin: "16px auto", border: "2px solid #e2e8f0", borderRadius: 12 }} />
            <p style={{ color: "#64748b", margin: "16px 0 0", fontSize: 12 }}>A coordenadora pode escanear este código com o celular para acessar e gerenciar a unidade.</p>
            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrCodeUrl;
                  a.download = `qr_${unidadeAtiva?.id || "unidade"}.png`;
                  a.click();
                }}
                style={{ ...bs, flex: 1 }}
              >
                ⬇️ Baixar
              </button>
              <button
                onClick={() => {
                  setModal(null);
                  setQrCodeUrl(null);
                  inventario.clearAtivas();
                }}
                style={{ ...bp, flex: 1 }}
              >
                ✓ Feito
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === "cancelar-inventario" && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 52, margin: "0 0 12px" }}>⚠️</p>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#dc2626" }}>Cancelar Inventário?</h2>
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "left" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#991b1b" }}>⚠️ Atenção! Se confirmar o cancelamento:</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#991b1b", lineHeight: 1.7 }}>
                <li>Todos os registros deste inventário serão <strong>apagados permanentemente</strong></li>
                <li>Os itens já inventariados <strong>perderão seus dados</strong> de estado, situação e fotos</li>
                <li>Esta ação <strong>não pode ser desfeita</strong></li>
              </ul>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px" }}>
              {inventario.unidadesAtivas.length} unidade{inventario.unidadesAtivas.length > 1 ? "s" : ""} · {inventario.totalFound} item{inventario.totalFound !== 1 ? "ns" : ""} registrado{inventario.totalFound !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bp, flex: 2, background: "#1e3a8a" }}>
                ← Voltar ao inventário
              </button>
              <button
                onClick={() => {
                  inventario.clearAtivas();
                  inventario.setInvSubTab("inventariar");
                  setModal(null);
                  showT("Sessão de inventário encerrada");
                }}
                style={{ ...bs, flex: 1, color: "#dc2626", border: "1px solid #fca5a5" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Overlay>
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
