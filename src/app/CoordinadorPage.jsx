import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, SC, SITUACOES } from "../constants/inventory.js";
import { fsGetAll, fsSet } from "../services/firebase.js";
import { uploadPhotos } from "../services/storage.js";
import { loadUnidades } from "../utils/xlsx.js";

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

  const isMob = window.innerWidth < 768;

  const showT = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    async function load() {
      try {
        const unidades = await loadUnidades(false);
        const unidade = unidades.find((u) => u.id === coordData?.unidadeId) || unidades.find((u) => u.nome === coordData?.unidadeNome);
        const unitItems = (unidade?.itens || [])
          .map((i) => ({ ...i, unidadeId: unidade?.id, unidadeNome: unidade?.nome }))
          .filter((i) => i.tipoEntrada !== "Permuta");
        setItens(unitItems);

        const [foundDocs, locDocs] = await Promise.all([fsGetAll("inventario"), fsGetAll("locais")]);
        setFound(foundDocs);
        setLocais(locDocs);
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
    width: "100%",
    border: "1.5px solid #d1d5db",
    borderRadius: 9,
    padding: "10px 13px",
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  const bp = {
    background: "#6b21a8",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  const bs = {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  const cd = {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  };

  const Overlay = ({ children, onClose }) => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 300,
        display: "flex",
        alignItems: isMob ? "flex-end" : "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: isMob ? "20px 20px 0 0" : 16,
          width: isMob ? "100%" : "560px",
          maxHeight: isMob ? "90vh" : "85vh",
          overflowY: "auto",
          padding: 24,
        }}
      >
        {children}
      </div>
    </div>
  );

  const openItem = (item) => {
    const f = foundMap[item.id];
    setDetItem(item);
    setDetEstado(f?.estado || "Bom");
    setDetSituacao(f?.situacao || "Em uso");
    setDetLocal(f?.localId || "");
    setDetObs(f?.obs || "");
    setDetMarca(f?.marca || item.marca || "");
    setDetExistingUrls((f?.fotoUrls || []).slice());
    setDetNewBase64([]);
    setModal("detalhe");
  };

  const saveItem = async () => {
    if (!detItem) return;
    setSaving(true);
    try {
      let fotoUrls = [...(detExistingUrls || [])];
      if (detNewBase64.length > 0) {
        const prefix = `coord/${token}/${detItem.id}_${Date.now()}`;
        const uploaded = await uploadPhotos(detNewBase64, prefix);
        fotoUrls = [...fotoUrls, ...uploaded];
      }

      const now = new Date();
      const entry = {
        patrimonioId: detItem.id,
        estado: detEstado,
        situacao: detSituacao,
        localId: detLocal || "",
        obs: detObs || "",
        marca: detMarca || "",
        origem: detItem.tipoEntrada || "Próprio",
        fotoUrls,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: coordData?.coordenadoraNome || "COORDENADORA",
        email: "",
        ultimaAtualizacao: now.toISOString(),
        coordenadora: coordData?.coordenadoraNome || "",
        matricula: coordData?.coordenadoraMatricula || "",
        coordToken: token,
      };

      await fsSet("inventario", detItem.id, entry);
      setFound((prev) => [...prev.filter((f) => f.patrimonioId !== detItem.id), { ...entry, _id: detItem.id }]);
      setModal(null);
      showT("✓ Salvo");
    } catch (e) {
      console.error(e);
      showT(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
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

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: "#6b21a8", color: "#fff", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 200 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>👩‍💼 {coordData?.coordenadoraNome}</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>{coordData?.unidadeNome}</p>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
          Sair
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMob ? 12 : 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 8 }}>
          {[
            { id: "itens", label: "📦 Meu Inventário", count: itens.length },
            { id: "relatorio", label: "📊 Relatório" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ padding: "10px 16px", borderRadius: 9, border: "none", background: tab === t.id ? "#6b21a8" : "#fff", color: tab === t.id ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
            >
              {t.label}
              {t.count !== undefined && <span style={{ background: tab === t.id ? "rgba(255,255,255,.3)" : "#e2e8f0", color: tab === t.id ? "#fff" : "#64748b", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {tab === "itens" && (
          <div>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>📦 Itens pendentes</h2>

            {pendentes.length === 0 ? (
              <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                <p style={{ fontSize: 48 }}>✅</p>
                <p style={{ color: "#94a3b8" }}>Todos os itens foram localizados!</p>
              </div>
            ) : (
              <>
                <TInput initial={search} onVal={setSearch} placeholder="🔍 Buscar item..." style={{ ...inp, marginBottom: 12 }} />

                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 10 }}>
                  {filteredPendentes.map((item) => (
                    <div key={item.id} onClick={() => openItem(item)} style={{ ...cd, cursor: "pointer", border: "1.5px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{item.descricao || item.especie || "—"}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Nº {item.id}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{item.fornecedor || "—"}</p>
                      <p style={{ margin: "10px 0 0", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Pendente</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "relatorio" && (
          <div>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>📊 Relatório</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total", valor: itens.length, cor: "#1e3a8a" },
                { label: "Localizados", valor: inventariados.length, cor: "#16a34a" },
                { label: "Pendentes", valor: pendentes.length, cor: "#dc2626" },
                { label: "Progresso", valor: `${itens.length > 0 ? Math.round((inventariados.length / itens.length) * 100) : 0}%`, cor: "#7c3aed" },
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

      {modal === "detalhe" && detItem && (
        <Overlay
          onClose={() => {
            setModal(null);
            setDetItem(null);
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>{detItem.descricao || detItem.especie || "—"}</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Nº {detItem.id}</p>
            </div>
            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer", padding: "4px 8px" }}>
              ✕
            </button>
          </div>

          {foundMap[detItem.id] ? (
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <Badge label="Inventariado" c={{ bg: "#d1fae5", tx: "#065f46" }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>
                {foundMap[detItem.id].data} {foundMap[detItem.id].hora || ""}
              </span>
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
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Situação</p>
              <select value={detSituacao} onChange={(e) => setDetSituacao(e.target.value)} style={inp}>
                {SITUACOES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Local</p>
          <select value={detLocal} onChange={(e) => setDetLocal(e.target.value)} style={inp}>
            <option value="">— Sem local —</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>

          <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Marca</p>
          <TInput initial={detMarca} onVal={setDetMarca} placeholder="Marca..." style={inp} />

          <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Observação</p>
          <TArea initial={detObs} onVal={setDetObs} rows={3} placeholder="Obs..." style={{ ...inp, resize: "none" }} />

          <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a" }}>📷 Fotos</p>
              <button onClick={() => setModal("camera")} style={{ ...bp, padding: "9px 12px" }}>
                Tirar / adicionar
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>
              {detExistingUrls.length + detNewBase64.length} foto(s)
            </p>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button
              onClick={() => {
                setModal(null);
                setDetItem(null);
              }}
              style={{ ...bs, flex: 1 }}
            >
              Cancelar
            </button>
            <button onClick={saveItem} disabled={saving} style={{ ...bp, flex: 1, background: "#16a34a", opacity: saving ? 0.8 : 1 }}>
              ✓ Salvar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "camera" && (
        <CameraModal
          existingPhotos={detNewBase64 || []}
          onCapture={(arr) => {
            setDetNewBase64(arr || []);
            setModal("detalhe");
          }}
          onClose={() => setModal("detalhe")}
        />
      )}

      {toast && <div style={{ position: "fixed", bottom: isMob ? 24 : 24, left: "50%", transform: "translateX(-50%)", background: "#6b21a8", color: "#fff", padding: "11px 24px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 400, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>{toast}</div>}
    </div>
  );
}
