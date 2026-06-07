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

  const pendentes = useMemo(() => itens.filter((i) => !foundSet.has(i.id)), [itens, foundSet]);
  const inventariados = useMemo(() => itens.filter((i) => foundSet.has(i.id)), [itens, foundSet]);

  const inp = {
    width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9,
    padding: "10px 13px", fontSize: isMob ? 16 : 14, fontFamily: "inherit",
    boxSizing: "border-box", outline: "none",
  };

  const bp = { background: "#6b21a8", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
  const bs = { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const cd = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

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
      const { workbook, XLSX } = await gerarRelatorioExcelCoord(itens, foundMap, nome);
      XLSX.writeFile(workbook, `inventario_coord_${Date.now()}.xlsx`);
      showT("Excel exportado");
    } catch (e) {
      showT(e.message || "Erro ao exportar");
    }
  };

  const filteredPendentes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return pendentes;
    return pendentes.filter(
      (i) =>
        String(i.id || "").includes(q) ||
        String(i.descricao || "").toLowerCase().includes(q) ||
        String(i.especie || "").toLowerCase().includes(q),
    );
  }, [pendentes, search]);

  const pendTotalPages = Math.max(1, Math.ceil(filteredPendentes.length / COORD_PER_PAGE));
  const pagedPendentes = filteredPendentes.slice((pendPage - 1) * COORD_PER_PAGE, pendPage * COORD_PER_PAGE);

  useEffect(() => {
    setPendPage(1);
  }, [search]);

  const campanhaFechada = isCampanhaFechada(campanha);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "#6b21a8", color: "#fff", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 200 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{coordDisplayName(coordData)}</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>
            {Array.isArray(coordData?.unidadeNomes) && coordData.unidadeNomes.length > 1
              ? `${coordData.unidadeNomes.length} unidades`
              : coordData?.unidadeNome}
          </p>
          {(queueStatus.pending > 0 || queueStatus.failed > 0 || !queueStatus.isOnline) && (
            <p style={{ margin: "4px 0 0", fontSize: 10, opacity: 0.9 }}>
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
                  style={{ marginLeft: 6, background: "rgba(255,255,255,.2)", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", padding: "1px 6px" }}
                >
                  Sync
                </button>
              ) : null}
            </p>
          )}
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
          Sair
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMob ? 12 : 24 }}>
        {campanhaFechada && (
          <div style={{ background: "#991b1b", color: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
            Inventário fechado — apenas consulta
          </div>
        )}
        {/* Tab nav */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 8 }}>
          {[
            { id: "itens", label: "Meu Inventário", count: itens.length },
            { id: "relatorio", label: "Relatório" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ padding: "10px 16px", borderRadius: 9, border: "none", background: tab === t.id ? "#6b21a8" : "#fff", color: tab === t.id ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
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
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>Itens pendentes</h2>

            {pendentes.length === 0 ? (
              <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                <p style={{ color: "#94a3b8" }}>Todos os itens foram localizados!</p>
              </div>
            ) : (
              <>
                <TInput initial={search} onVal={setSearch} placeholder="Buscar item..." style={{ ...inp, marginBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 10 }}>
                  {pagedPendentes.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => openItem(item)}
                      style={{ ...cd, cursor: "pointer", border: "1.5px solid #e2e8f0", display: "flex", flexDirection: "column" }}
                    >
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{item.descricao || item.especie || "—"}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Nº {item.id}</p>
                      {item.tipoEntrada && item.tipoEntrada !== "Permuta" && (
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>{maskTipoEntrada(item.tipoEntrada)}</p>
                      )}
                      <p style={{ margin: "10px 0 0", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Pendente</p>
                    </div>
                  ))}
                </div>
                {pendTotalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
                    <button disabled={pendPage <= 1} onClick={() => setPendPage((p) => Math.max(1, p - 1))} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                      ‹
                    </button>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Pág {pendPage}/{pendTotalPages} · {filteredPendentes.length} pendentes
                    </span>
                    <button disabled={pendPage >= pendTotalPages} onClick={() => setPendPage((p) => Math.min(pendTotalPages, p + 1))} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                      ›
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Also show already-found items */}
            {inventariados.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#16a34a" }}>Já localizados ({inventariados.length})</h3>
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 8 }}>
                  {inventariados.map((item) => {
                    const f = foundMap[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => openItem(item)}
                        style={{ ...cd, cursor: "pointer", border: "1.5px solid #bbf7d0", background: "#f0fdf4", display: "flex", gap: 10, alignItems: "center" }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{item.descricao || item.especie || "—"}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>Nº {item.id}</p>
                          {f && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              <Badge label={f.estado} c={EC[f.estado]} />
                              {/* Only show masked situacao — never show "Permuta" */}
                              <Badge label={maskSituacao(f.situacao)} c={SC[maskSituacao(f.situacao)] || SC["Em uso"]} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total",       valor: itens.length,         cor: "#1e3a8a" },
                { label: "Localizados", valor: inventariados.length,  cor: "#16a34a" },
                { label: "Pendentes",   valor: pendentes.length,      cor: "#dc2626" },
                { label: "Progresso",   valor: `${itens.length > 0 ? Math.round((inventariados.length / itens.length) * 100) : 0}%`, cor: "#7c3aed" },
              ].map((stat) => (
                <div key={stat.label} style={cd}>
                  <p style={{ margin: 0, fontSize: isMob ? 20 : 28, fontWeight: 700, color: stat.cor }}>{stat.valor}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {modal === "detalhe" && detItem && (
        <Overlay onClose={() => { setModal(null); setDetItem(null); }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
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
                  <Badge label="Aguardando verificação" c={{ bg: "#dbeafe", tx: "#1e40af" }} />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
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

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
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

      {toast && (
        <div style={{ position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", background: "#6b21a8", color: "#fff", padding: "11px 24px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 400, boxShadow: "0 4px 16px rgba(0,0,0,.25)", maxWidth: "92vw" }}>
          {toast}
        </div>
      )}

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
