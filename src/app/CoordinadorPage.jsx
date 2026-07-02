import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, SC, SITUACOES } from "../constants/inventory.js";
import { fsGetAll, fsSet } from "../services/firebase.js";
import { uploadPhotos } from "../services/storage.js";
import { compressPhotoArray } from "../utils/performance.js";
import { loadUnidades } from "../utils/xlsx.js";
import { maskTipoEntrada } from "../utils/itemHelpers.js";
import { PhotoThumb } from "../components/PhotoThumb.jsx";
import { getDisplayPhotoUrl } from "../services/storage.js";
import { gerarRelatorioExcelCoord, offlineManager, queueOfflineWithPhotos } from "../services/features.js";
import { fecharCampanha, isCampanhaFechada, loadCampanhaAtiva } from "../services/campanha.js";
import { getAppStyles, COLORS } from "../constants/theme.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";

const COORD_PER_PAGE = 30;

function getInventarianteEvidence(f) {
  if (!f) return null;
  if (f.registroInventariante) return f.registroInventariante;
  if (f.coordToken || f.coordenadora) return null;
  const usuario = String(f.usuario || "").trim().toUpperCase();
  if (usuario && usuario !== "COORDENADORA") {
    return {
      estado: f.estado,
      situacao: f.situacao,
      localId: f.localId || "",
      obs: f.obs || "",
      fotoUrls: f.fotoUrls || [],
      usuario: f.usuario || "",
      data: f.data || "",
      hora: f.hora || "",
    };
  }
  return null;
}

function InvPhoto({ src, onView }) {
  const [url, setUrl] = useState(src || "");
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = await getDisplayPhotoUrl(src);
      if (alive) setUrl(next || src || "");
    })();
    return () => {
      alive = false;
    };
  }, [src]);
  if (!url) return null;
  return (
    <PhotoThumb
      src={url}
      size={72}
      onImageClick={() => onView?.(url)}
    />
  );
}

function getCoordUnidadeIds(coord) {
  if (Array.isArray(coord?.unidadeIds) && coord.unidadeIds.length) return coord.unidadeIds;
  if (coord?.unidadeId) return [coord.unidadeId];
  return [];
}

function coordDisplayName(coord) {
  return coord?.nome || coord?.coordenadoraNome || "Coordenadora";
}

function coordDisplayMatricula(coord) {
  return coord?.matricula || coord?.coordenadoraMatricula || "";
}

function isRegistroInventariante(f) {
  if (!f) return false;
  if (f.registroInventariante) return true;
  if (f.coordToken || f.coordenadora) return false;
  const usuario = String(f.usuario || "").trim().toUpperCase();
  return Boolean(usuario && usuario !== "COORDENADORA");
}

function mergeManuais(unids, manuais) {
  if (!Array.isArray(manuais) || manuais.length === 0) return unids;
  const byUnit = new Map();
  for (const m of manuais) {
    const unidadeId = m.unidadeId;
    if (!unidadeId) continue;
    if (!byUnit.has(unidadeId)) byUnit.set(unidadeId, []);
    byUnit.get(unidadeId).push({
      id: m._id || m.id,
      patrimonioLabel: m.patrimonioLabel ?? null,
      data: m.data || "",
      especie: m.especie || "",
      descricao: m.descricao || "",
      marca: m.marca || "",
      fornecedor: m.fornecedor || "",
      empenho: m.empenho || "",
      nf: m.nf || "",
      dataNF: m.dataNF || "",
      tipoEntrada: m.tipoEntrada || "Próprio",
      valor: Number(m.valor || 0) || 0,
      valorAtual: Number(m.valorAtual || 0) || 0,
      ...(m.imei ? { imei: m.imei } : {}),
      isManual: true,
    });
  }
  for (const u of unids) {
    const extras = byUnit.get(u.id);
    if (!extras?.length) continue;
    const existingIds = new Set((u.itens || []).map((i) => i.id));
    for (const e of extras) {
      if (!existingIds.has(e.id)) u.itens.push(e);
    }
  }
  return unids;
}

// Situacoes available to coordinator — Permuta is hidden
const SITUACOES_COORD = SITUACOES.filter((s) => s !== "Permuta");

// Mask permuta situation: coordinator sees "Em uso" instead of "Permuta"
function maskSituacao(situacao) {
  return situacao === "Permuta" ? "Em uso" : situacao;
}

export function CoordinadorPage({ token, coordData, onLogout }) {
  const [itens, setItens] = useState([]);
  const [found, setFound] = useState([]);
  const [locais, setLocais] = useState([]);
  const [tab, setTab] = useState("itens");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [detItem, setDetItem] = useState(null);
  const [detEstado, setDetEstado] = useState("Bom");
  const [detSituacao, setDetSituacao] = useState("Em uso");
  const [detLocal, setDetLocal] = useState("");
  const [detObs, setDetObs] = useState("");
  const [detMarca, setDetMarca] = useState("");
  const [detExistingUrls, setDetExistingUrls] = useState([]);
  const [detNewBase64, setDetNewBase64] = useState([]);
  const [saving, setSaving] = useState(false);
  const [imgViewSrc, setImgViewSrc] = useState(null);
  const [pendPage, setPendPage] = useState(1);
  const [campanha, setCampanha] = useState(null);
  const [filtroLocal, setFiltroLocal] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [filtroFoto, setFiltroFoto] = useState("");
  const [agruparLocal, setAgruparLocal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(COORD_PER_PAGE);
  const { queueStatus, updateQueueStatus } = useOfflineQueue();
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

  const isMob = window.innerWidth < 768;

  const showT = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!coordData?.uid) return;

    const checkStatus = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const { obterCoordPorUid } = await import("../services/firebase.js");
        const coord = await obterCoordPorUid(coordData?.uid);

        if (!coord || coord.status === "rejeitada" || coord.status === "desativada") {
          try {
            localStorage.removeItem("inv-coord-session");
          } catch {}
          onLogout();
          showT("Seu acesso foi revogado pelo administrador");
        }
      } catch (e) {
        console.error("Erro ao verificar status:", e);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [coordData?.uid, onLogout]);

  useEffect(() => {
    async function load() {
      try {
        const unitIds = getCoordUnidadeIds(coordData);
        const unitIdSet = new Set(unitIds);

        let unidades = await loadUnidades(false);
        try {
          const manuais = await fsGetAll("manuais");
          unidades = mergeManuais(unidades, manuais);
        } catch {}

        let selectedUnits = unitIds.length
          ? unidades.filter((u) => unitIdSet.has(u.id))
          : [];
        if (!selectedUnits.length && coordData?.unidadeNome) {
          selectedUnits = unidades.filter((u) => u.nome === coordData.unidadeNome);
        }
        if (!selectedUnits.length && coordData?.unidadeId) {
          const one = unidades.find((u) => u.id === coordData.unidadeId);
          if (one) selectedUnits = [one];
        }

        const unitItems = selectedUnits.flatMap((unidade) =>
          (unidade?.itens || []).map((i) => ({ ...i, unidadeId: unidade.id, unidadeNome: unidade.nome })),
        );
        setItens(unitItems);

        let foundDocs = [];
        if (unitIds.length === 1) {
          foundDocs = await fsGetAll("inventario", {
            where: [{ field: "unidadeId", op: "EQUAL", value: unitIds[0] }],
            orderBy: ["__name__"],
            pageSize: 300,
          });
        } else if (unitIds.length > 1) {
          const chunks = await Promise.all(
            unitIds.map((uid) =>
              fsGetAll("inventario", {
                where: [{ field: "unidadeId", op: "EQUAL", value: uid }],
                orderBy: ["__name__"],
                pageSize: 300,
              })
            )
          );
          const seen = new Set();
          for (const chunk of chunks) {
            for (const d of chunk) {
              const pid = d.patrimonioId || d._id;
              if (seen.has(pid)) continue;
              seen.add(pid);
              foundDocs.push(d);
            }
          }
        }

        const itemIds = new Set(unitItems.map((i) => i.id));
        const scopedFound = foundDocs.filter(
          (f) => itemIds.has(f.patrimonioId) && (!f.unidadeId || unitIdSet.size === 0 || unitIdSet.has(f.unidadeId))
        );
        setFound(scopedFound);

        let locDocs = [];
        if (unitIds.length === 1) {
          locDocs = await fsGetAll("locais", {
            where: [{ field: "unidadeIds", op: "ARRAY_CONTAINS", value: unitIds[0] }],
            pageSize: 150,
          });
        } else if (unitIds.length > 1) {
          const locChunks = await Promise.all(
            unitIds.map((uid) =>
              fsGetAll("locais", {
                where: [{ field: "unidadeIds", op: "ARRAY_CONTAINS", value: uid }],
                pageSize: 150,
              })
            )
          );
          const locSeen = new Set();
          for (const chunk of locChunks) {
            for (const d of chunk) {
              const lid = d._id || d.id;
              if (locSeen.has(lid)) continue;
              locSeen.add(lid);
              locDocs.push(d);
            }
          }
        }

        const usedLocalIds = new Set(scopedFound.map((f) => f.localId).filter(Boolean));
        const scopedLocais = locDocs
          .map((d) => ({ ...d, id: d._id || d.id }))
          .filter((l) => {
            const id = l.id || l._id;
            if (usedLocalIds.has(id)) return true;
            const lu = Array.isArray(l.unidadeIds) ? l.unidadeIds : [];
            if (lu.length && unitIdSet.size) return lu.some((uid) => unitIdSet.has(uid));
            return false;
          });
        setLocais(scopedLocais);

        try {
          setCampanha(await loadCampanhaAtiva());
        } catch {}
      } catch (e) {
        console.error("Erro ao carregar:", e);
        showT("Erro ao carregar dados");
      }
    }
    load();
  }, [coordData]);

  const unitItemIds = useMemo(() => new Set(itens.map((i) => i.id)), [itens]);
  const unitFound = useMemo(() => found.filter((f) => unitItemIds.has(f.patrimonioId)), [found, unitItemIds]);

  const foundMap = useMemo(() => {
    const m = {};
    for (const f of unitFound) m[f.patrimonioId] = f;
    return m;
  }, [unitFound]);

  const foundSet = useMemo(() => new Set(unitFound.map((f) => f.patrimonioId)), [unitFound]);

  const pendentes = useMemo(() => [], []);
  const inventariados = useMemo(() => itens.filter((i) => foundSet.has(i.id) && i.tipoEntrada !== "Incorporado"), [itens, foundSet]);

  const { inp, bp, bs, cd } = getAppStyles(isMob);

  const Overlay = ({ children, onClose }) => (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: isMob ? "flex-end" : "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: isMob ? "20px 20px 0 0" : 16, width: isMob ? "100%" : "560px", maxHeight: isMob ? "90dvh" : "85vh", overflowY: "auto", padding: 24, paddingBottom: isMob ? "calc(24px + env(safe-area-inset-bottom, 0px))" : 24 }}
      >
        {children}
      </div>
    </div>
  );

  const openItem = (item) => {
    const f = foundMap[item.id];
    const fromInv = isRegistroInventariante(f);
    const ev = getInventarianteEvidence(f);
    setDetItem(item);
    setDetEstado(f?.estado || "Bom");
    setDetSituacao(maskSituacao(f?.situacao || "Em uso"));
    setDetLocal(fromInv && !f?.coordToken ? "" : f?.localId || "");
    setDetObs("");
    setDetMarca(fromInv && !f?.coordToken ? item.marca || "" : f?.marca || item.marca || "");
    setDetExistingUrls(f?.coordToken || f?.coordenadora ? (f?.fotoUrls || []).slice() : []);
    revokeBlobUrls(detNewBase64);
    setDetNewBase64([]);
    setModal("detalhe");
  };

  const saveItem = async () => {
    if (!detItem) return;
    if (isCampanhaFechada(campanha)) {
      showT("Inventário fechado — alterações não permitidas");
      return;
    }
    setSaving(true);
    try {
      const prev = foundMap[detItem.id];
      const fromInv = isRegistroInventariante(prev);
      const isPermutaItem = prev?.situacao === "Permuta" || detItem?.tipoEntrada === "Permuta";
      let fotoUrls = fromInv ? [] : [...(detExistingUrls || [])];

      const now = new Date();
      const registroInventariante =
        prev?.registroInventariante ||
        getInventarianteEvidence(prev) ||
        (fromInv
          ? {
              estado: prev.estado,
              situacao: prev.situacao,
              localId: prev.localId || "",
              obs: prev.obs || "",
              fotoUrls: prev.fotoUrls || [],
              usuario: prev.usuario || "",
              data: prev.data || "",
              hora: prev.hora || "",
            }
          : null);

      const entry = {
        patrimonioId: detItem.id,
        unidadeId: coordData?.unidadeId || detItem?.unidadeId || prev?.unidadeId || "",
        unidadeNome: coordData?.unidadeNome || detItem?.unidadeNome || prev?.unidadeNome || "",
        estado: detEstado,
        situacao: isPermutaItem ? "Permuta" : detSituacao,
        localId: detLocal || "",
        obs: detObs || "",
        marca: detMarca || "",
        origem: isPermutaItem ? "Permuta" : detItem.tipoEntrada || prev?.origem || "Próprio",
        fotoUrls,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: coordDisplayName(coordData),
        email: coordData?.email || "",
        ultimaAtualizacao: now.toISOString(),
        coordenadora: coordDisplayName(coordData),
        matricula: coordDisplayMatricula(coordData),
        coordToken: token,
        ...(registroInventariante ? { registroInventariante } : {}),
      };

      if (!navigator.onLine) {
        await queueOfflineWithPhotos({
          type: "save",
          data: { collection: "inventario", docId: detItem.id, content: entry },
          photos: detNewBase64,
          uploadPrefix: `coord/${token}/${detItem.id}_${Date.now()}`,
        });
        updateQueueStatus();
        setFound((prevList) => [...prevList.filter((f) => f.patrimonioId !== detItem.id), { ...entry, _id: detItem.id }]);
        revokeBlobUrls(detNewBase64);
        setDetNewBase64([]);
        setModal(null);
        showT("Na fila (offline)");
        return;
      }

      if (detNewBase64.length > 0) {
        const prefix = `coord/${token}/${detItem.id}_${Date.now()}`;
        const compressed = await compressPhotoArray(detNewBase64);
        const uploaded = await uploadPhotos(compressed, prefix);
        fotoUrls = [...fotoUrls, ...uploaded];
        entry.fotoUrls = fotoUrls;
      }

      await fsSet("inventario", detItem.id, entry);
      setFound((prevList) => [...prevList.filter((f) => f.patrimonioId !== detItem.id), { ...entry, _id: detItem.id }]);
      revokeBlobUrls(detNewBase64);
      setModal(null);
      showT("Salvo");
    } catch (e) {
      console.error(e);
      showT(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    try {
      const nome =
        Array.isArray(coordData?.unidadeNomes) && coordData.unidadeNomes.length
          ? coordData.unidadeNomes.join(", ")
          : coordData?.unidadeNome || "";
      const { workbook, XLSX } = await gerarRelatorioExcelCoord(inventariados, foundMap, nome);
      XLSX.writeFile(workbook, `inventario_coord_${Date.now()}.xlsx`);
      showT("Excel exportado");
    } catch (e) {
      showT(e.message || "Erro ao exportar");
    }
  };

  const campanhaFechada = isCampanhaFechada(campanha);

  return (
    <div style={{ minHeight: "100vh", background: "var(--gov-bg)" }}>
      <header className="gov-header">
        <div className="gov-header__flag" aria-hidden="true" />
        <div className="gov-header__inner">
          <div className="gov-brand">
            <div className="gov-brand__seal" aria-hidden="true">S</div>
            <div>
              <p className="gov-brand__org">Secretaria Municipal — SEMCAS</p>
              <p className="gov-brand__sys">{coordDisplayName(coordData)}</p>
              <p className="gov-header__meta">
                {Array.isArray(coordData?.unidadeNomes) && coordData.unidadeNomes.length > 1
                  ? `${coordData.unidadeNomes.length} unidades`
                  : coordData?.unidadeNome}
              </p>
              {(queueStatus.pending > 0 || queueStatus.failed > 0 || !queueStatus.isOnline) && (
                <div className="gov-header__status" style={{ marginTop: 4 }}>
                  {!queueStatus.isOnline
                    ? `Offline · ${queueStatus.pending} na fila`
                    : `${queueStatus.pending} pendente(s)${queueStatus.failed ? ` · ${queueStatus.failed} falha(s)` : ""}`}
                  {queueStatus.isOnline && (queueStatus.pending > 0 || queueStatus.failed > 0) ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await offlineManager.retrySync();
                        updateQueueStatus();
                      }}
                      className="gov-btn gov-btn--ghost"
                      style={{ marginLeft: 8, padding: "2px 8px", fontSize: 10 }}
                    >
                      Sync
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="gov-header__actions">
            <button type="button" className="gov-btn gov-btn--ghost" onClick={onLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMob ? 12 : 24 }}>
        {campanhaFechada && (
          <div className="gov-banner gov-banner--danger" style={{ borderRadius: 4, marginBottom: 12 }}>
            Inventário fechado — apenas consulta
          </div>
        )}
        {/* Tab nav */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 8 }}>
          {[
            { id: "itens", label: "Meu Inventário", count: inventariados.length },
            { id: "relatorio", label: "Relatório" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 4,
                border: `1px solid ${tab === t.id ? COLORS.primary : COLORS.borderLight}`,
                background: tab === t.id ? COLORS.primary : COLORS.surface,
                color: tab === t.id ? "#fff" : COLORS.text,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{ background: tab === t.id ? "rgba(255,255,255,.3)" : "#e2e8f0", color: tab === t.id ? "#fff" : "#64748b", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Itens tab */}
        {tab === "itens" && (
          <div>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>Itens localizados</h2>
            {inventariados.length === 0 ? (
              <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                <p style={{ color: "#94a3b8" }}>Nenhum item localizado até o momento.</p>
              </div>
            ) : (
              (() => {
                const getLocalNome = (localId) => locais.find((l) => l.id === localId)?.nome || "Sem local";

                const q = String(search || "").trim().toLowerCase();
                const filtrados = inventariados.filter((i) => {
                  const f = foundMap[i.id];
                  if (filtroLocal && (f?.localId || "") !== filtroLocal) return false;
                  if (filtroEstado && (f?.estado || "") !== filtroEstado) return false;
                  if (filtroSituacao && maskSituacao(f?.situacao || "") !== filtroSituacao) return false;
                  if (filtroFoto === "com" && !(f?.fotoUrls?.length > 0)) return false;
                  if (filtroFoto === "sem" && f?.fotoUrls?.length > 0) return false;
                  if (!q) return true;
                  return (
                    String(i.id || "").toLowerCase().includes(q) ||
                    String(i.patrimonioLabel || "").toLowerCase().includes(q) ||
                    String(i.descricao || "").toLowerCase().includes(q) ||
                    String(i.especie || "").toLowerCase().includes(q) ||
                    String(i.marca || f?.marca || "").toLowerCase().includes(q) ||
                    String(f?.descricaoEdit || "").toLowerCase().includes(q) ||
                    getLocalNome(f?.localId).toLowerCase().includes(q)
                  );
                });

                const estadoCounts = {};
                let comFoto = 0;
                for (const i of inventariados) {
                  const f = foundMap[i.id];
                  const e = f?.estado || "—";
                  estadoCounts[e] = (estadoCounts[e] || 0) + 1;
                  if (f?.fotoUrls?.length > 0) comFoto++;
                }

                const selStyle = { ...inp, minHeight: 44, fontSize: isMob ? 14 : 13 };
                const filtroAtivo = filtroLocal || filtroEstado || filtroSituacao || filtroFoto || q;

                const renderCard = (item) => {
                  const f = foundMap[item.id];
                  const foto = f?.fotoUrls?.[0];
                  const descricao = f?.descricaoEdit || item.descricao || item.especie || "—";
                  return (
                    <div
                      key={item.id}
                      onClick={() => openItem(item)}
                      style={{ ...cd, cursor: "pointer", border: "1px solid #d1e7d8", display: "flex", gap: 12, alignItems: "flex-start", padding: 12 }}
                    >
                      {foto ? (
                        <InvPhoto src={foto} onView={setImgViewSrc} />
                      ) : (
                        <div style={{ width: 72, height: 72, borderRadius: 8, background: "#f1f5f9", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8", fontWeight: 700, flexShrink: 0, textAlign: "center", lineHeight: 1.3 }}>
                          Sem<br />foto
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{descricao}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                          Nº {item.patrimonioLabel || item.id}
                          {(f?.marca || item.marca) ? ` · ${f?.marca || item.marca}` : ""}
                          {f?.imei ? ` · IMEI ${f.imei}` : ""}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569", fontWeight: 600 }}>
                          Local: {getLocalNome(f?.localId)}
                        </p>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                          {f?.estado && <Badge label={f.estado} c={EC[f.estado]} />}
                          {f?.situacao && <Badge label={maskSituacao(f.situacao)} c={SC[maskSituacao(f.situacao)] || SC["Em uso"]} />}
                          {f?.fotoUrls?.length > 1 && <Badge label={`${f.fotoUrls.length} fotos`} c={{ bg: "#eff6ff", tx: "#1d4ed8" }} />}
                          {f?.plaquetaAusente && <Badge label="Sem plaqueta" c={{ bg: "#ffedd5", tx: "#9a3412" }} />}
                          {isRegistroInventariante(f) && <Badge label="Verificar" c={{ bg: COLORS.primaryLight, tx: COLORS.primary }} />}
                        </div>
                        {f?.data && (
                          <p style={{ margin: "6px 0 0", fontSize: 10, color: "#94a3b8" }}>
                            Registrado em {f.data}{f.hora ? ` às ${f.hora}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Resumo rápido */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <div style={{ ...cd, padding: "10px 14px", flex: "1 1 120px" }}>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{inventariados.length}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Localizados</p>
                      </div>
                      <div style={{ ...cd, padding: "10px 14px", flex: "1 1 120px" }}>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1d4ed8" }}>{comFoto}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Com foto</p>
                      </div>
                      <div style={{ ...cd, padding: "10px 14px", flex: "1 1 120px" }}>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#7c3aed" }}>{locais.length}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Locais</p>
                      </div>
                    </div>

                    {/* Chips por estado (clique para filtrar) */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {ESTADOS.filter((e) => estadoCounts[e]).map((e) => (
                        <button
                          key={e}
                          onClick={() => setFiltroEstado(filtroEstado === e ? "" : e)}
                          style={{
                            background: filtroEstado === e ? EC[e].tx : EC[e].bg,
                            color: filtroEstado === e ? "#fff" : EC[e].tx,
                            border: `1px solid ${EC[e].border || EC[e].tx}`,
                            borderRadius: 99,
                            padding: isMob ? "8px 14px" : "5px 12px",
                            minHeight: isMob ? 40 : undefined,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            touchAction: "manipulation",
                          }}
                        >
                          {e}: {estadoCounts[e]}
                        </button>
                      ))}
                    </div>

                    <TInput
                      initial={search}
                      onVal={(v) => { setSearch(v); setVisibleCount(COORD_PER_PAGE); }}
                      placeholder="Buscar por nº, descrição, marca, local..."
                      style={{ ...inp, marginBottom: 10 }}
                    />

                    {/* Filtros */}
                    <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
                      <select value={filtroLocal} onChange={(e) => { setFiltroLocal(e.target.value); setVisibleCount(COORD_PER_PAGE); }} style={selStyle}>
                        <option value="">Local: todos</option>
                        {locais.map((l) => (
                          <option key={l.id} value={l.id}>{l.nome}</option>
                        ))}
                      </select>
                      <select value={filtroSituacao} onChange={(e) => { setFiltroSituacao(e.target.value); setVisibleCount(COORD_PER_PAGE); }} style={selStyle}>
                        <option value="">Situação: todas</option>
                        {SITUACOES_COORD.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <select value={filtroFoto} onChange={(e) => { setFiltroFoto(e.target.value); setVisibleCount(COORD_PER_PAGE); }} style={selStyle}>
                        <option value="">Fotos: todas</option>
                        <option value="com">Com foto</option>
                        <option value="sem">Sem foto</option>
                      </select>
                      <button
                        onClick={() => setAgruparLocal((v) => !v)}
                        style={{
                          ...bs,
                          minHeight: 44,
                          fontSize: isMob ? 13 : 12,
                          background: agruparLocal ? COLORS.primary : "#fff",
                          color: agruparLocal ? "#fff" : COLORS.text,
                          borderColor: agruparLocal ? COLORS.primaryDark : COLORS.border,
                        }}
                      >
                        {agruparLocal ? "Agrupado por local" : "Agrupar por local"}
                      </button>
                    </div>

                    {filtroAtivo ? (
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>
                        {filtrados.length} de {inventariados.length} itens
                        {(filtroLocal || filtroEstado || filtroSituacao || filtroFoto) && (
                          <button
                            onClick={() => { setFiltroLocal(""); setFiltroEstado(""); setFiltroSituacao(""); setFiltroFoto(""); setVisibleCount(COORD_PER_PAGE); }}
                            style={{ background: "none", border: "none", color: COLORS.primary, fontWeight: 700, fontSize: 12, cursor: "pointer", marginLeft: 8, padding: "4px 6px" }}
                          >
                            Limpar filtros
                          </button>
                        )}
                      </p>
                    ) : null}

                    {filtrados.length === 0 ? (
                      <div style={{ ...cd, textAlign: "center", padding: 32 }}>
                        <p style={{ color: "#94a3b8", margin: 0, fontSize: 13 }}>Nenhum item corresponde aos filtros.</p>
                      </div>
                    ) : agruparLocal ? (
                      (() => {
                        const grupos = new Map();
                        for (const item of filtrados) {
                          const nome = getLocalNome(foundMap[item.id]?.localId);
                          if (!grupos.has(nome)) grupos.set(nome, []);
                          grupos.get(nome).push(item);
                        }
                        const nomes = [...grupos.keys()].sort((a, b) => (a === "Sem local" ? 1 : b === "Sem local" ? -1 : a.localeCompare(b)));
                        return (
                          <div style={{ display: "grid", gap: 14 }}>
                            {nomes.map((nome) => (
                              <div key={nome}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
                                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{nome}</h3>
                                  <span style={{ background: "#e2e8f0", color: "#475569", borderRadius: 99, fontSize: 11, fontWeight: 800, padding: "2px 8px" }}>
                                    {grupos.get(nome).length}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(320px,1fr))", gap: 8 }}>
                                  {grupos.get(nome).map(renderCard)}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(320px,1fr))", gap: 8 }}>
                          {filtrados.slice(0, visibleCount).map(renderCard)}
                        </div>
                        {filtrados.length > visibleCount && (
                          <button
                            onClick={() => setVisibleCount((n) => n + COORD_PER_PAGE)}
                            style={{ ...bs, width: "100%", marginTop: 12, minHeight: 44 }}
                          >
                            Carregar mais ({filtrados.length - visibleCount} restantes)
                          </button>
                        )}
                      </>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {/* Relatório tab */}
        {tab === "relatorio" && (
          <div>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>Relatório</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={exportExcel} style={{ ...bp, fontSize: 12, background: "#0f766e" }}>
                Exportar Excel
              </button>
              {!campanhaFechada && (
                <button
                  onClick={async () => {
                    if (!window.confirm("Fechar o inventário? Inventariantes não poderão registrar novos itens.")) return;
                    await fecharCampanha(coordData?.email || coordDisplayName(coordData));
                    setCampanha(await loadCampanhaAtiva());
                    showT("Inventário fechado");
                  }}
                  style={{ ...bs, fontSize: 12, color: "#991b1b", borderColor: "#fca5a5" }}
                >
                  Fechar inventário
                </button>
              )}
            </div>
            {(() => {
              const comFoto = inventariados.filter((i) => foundMap[i.id]?.fotoUrls?.length > 0).length;
              const aVerificar = inventariados.filter((i) => isRegistroInventariante(foundMap[i.id])).length;
              const stats = [
                { label: "Localizados", valor: inventariados.length, cor: "#16a34a" },
                { label: "Com foto", valor: comFoto, cor: "#1d4ed8" },
                { label: "Aguardando verificação", valor: aVerificar, cor: "#b45309" },
                { label: "Locais", valor: locais.length, cor: "#7c3aed" },
              ];
              const porEstado = ESTADOS
                .map((e) => ({ e, n: inventariados.filter((i) => foundMap[i.id]?.estado === e).length }))
                .filter(({ n }) => n > 0);
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                    {stats.map((stat) => (
                      <div key={stat.label} style={cd}>
                        <p style={{ margin: 0, fontSize: isMob ? 20 : 28, fontWeight: 700, color: stat.cor }}>{stat.valor}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  {porEstado.length > 0 && (
                    <div style={{ ...cd, marginBottom: 20 }}>
                      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#334155" }}>Por estado de conservação</p>
                      <div style={{ display: "grid", gap: 8 }}>
                        {porEstado.map(({ e, n }) => (
                          <div key={e} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: EC[e]?.tx || "#334155", width: 90, flexShrink: 0 }}>{e}</span>
                            <div style={{ flex: 1, height: 10, borderRadius: 5, background: "#f1f5f9", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.round((n / inventariados.length) * 100)}%`, background: EC[e]?.tx || "#94a3b8", borderRadius: 5 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", width: 34, textAlign: "right", flexShrink: 0 }}>{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {modal === "detalhe" && detItem && (
        <Overlay onClose={() => { setModal(null); setDetItem(null); }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>{detItem.descricao || detItem.especie || "—"}</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Nº {detItem.id}</p>
            </div>
            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: 12, color: "#64748b", cursor: "pointer", padding: "8px 10px", fontWeight: 700 }}>Fechar</button>
          </div>

          {foundMap[detItem.id] ? (
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <Badge label="Inventariado" c={{ bg: "#d1fae5", tx: "#065f46" }} />
                {isRegistroInventariante(foundMap[detItem.id]) && (
                  <Badge label="Aguardando verificação" c={{ bg: COLORS.primaryLight, tx: COLORS.primary, border: "#B8D4F0" }} />
                )}
              </div>
              {(() => {
                const ev = getInventarianteEvidence(foundMap[detItem.id]);
                if (!ev) return null;
                const invPhotos = Array.isArray(ev.fotoUrls) ? ev.fotoUrls : [];
                return (
                  <div style={{ marginTop: 10, padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#475569" }}>Registro do inventariante</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Badge label={ev.estado || "—"} c={EC[ev.estado] || EC.Bom} />
                      <Badge label={maskSituacao(ev.situacao)} c={SC[maskSituacao(ev.situacao)] || SC["Em uso"]} />
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>
                      Local: {locais.find((l) => l.id === ev.localId)?.nome || "—"}
                    </p>
                    {ev.obs ? (
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.45 }}>
                        <strong>Obs:</strong> {ev.obs}
                      </p>
                    ) : null}
                    <p style={{ margin: "6px 0 0", fontSize: 10, color: "#94a3b8" }}>
                      {ev.usuario || "Inventariante"}{ev.data ? ` · ${ev.data}` : ""}{ev.hora ? ` ${ev.hora}` : ""}
                    </p>
                    {invPhotos.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#475569" }}>Fotos do inventariante ({invPhotos.length})</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {invPhotos.map((ph, i) => (
                            <InvPhoto key={i} src={ph} onView={setImgViewSrc} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 10 }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Estado</p>
              <select value={detEstado} onChange={(e) => setDetEstado(e.target.value)} style={inp}>
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Situação</p>
              <select value={detSituacao} onChange={(e) => setDetSituacao(e.target.value)} style={inp}>
                {/* Coordinator cannot set or see "Permuta" */}
                {SITUACOES_COORD.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Local</p>
          <select value={detLocal} onChange={(e) => setDetLocal(e.target.value)} style={inp}>
            <option value="">— Sem local —</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>

          <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Marca</p>
          <TInput initial={detMarca} onVal={setDetMarca} placeholder="Marca..." style={inp} />

          <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>
            {isRegistroInventariante(foundMap[detItem.id]) ? "Observação da verificação" : "Observação"}
          </p>
          <TArea initial={detObs} onVal={setDetObs} rows={3} placeholder="Sua observação..." style={{ ...inp, resize: "none" }} />

          <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                {isRegistroInventariante(foundMap[detItem.id]) ? "Fotos da verificação" : "Fotos"}
              </p>
              <button onClick={() => setModal("camera")} style={{ ...bp, padding: "9px 12px", fontSize: 12 }}>
                Tirar / adicionar
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>
              {detExistingUrls.length + detNewBase64.length} foto(s)
            </p>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={() => { setModal(null); setDetItem(null); }} style={{ ...bs, flex: 1 }}>Cancelar</button>
            <button onClick={saveItem} disabled={saving} style={{ ...bp, flex: 1, background: "#16a34a", opacity: saving ? 0.8 : 1 }}>
              Salvar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "camera" && (
        <CameraModal
          existingPhotos={detNewBase64 || []}
          onCapture={(arr) => { revokeBlobUrls(detNewBase64); setDetNewBase64(arr || []); setModal("detalhe"); }}
          onClose={() => setModal("detalhe")}
        />
      )}

      {toast && <div className="gov-toast">{toast}</div>}

      {imgViewSrc && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setImgViewSrc(null)}
        >
          <img src={imgViewSrc} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
