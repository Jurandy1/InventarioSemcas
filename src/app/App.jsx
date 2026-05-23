import React, { useEffect, useRef, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, PER_PAGE, SC, SITUACOES } from "../constants/inventory.js";
import { clearFirebaseSession, fsDel, fsGet, fsGetAll, fsSet, isFirebaseConfigured, setFirebaseSession, fbLogin, fbRegister } from "../services/firebase.js";
import { uploadPhotos, isStorageOk as isCloudinaryOk, deletePhoto } from "../services/storage.js";
import { loadUnidades } from "../utils/xlsx.js";

export default function App() {
  const firebaseOk = isFirebaseConfigured();
  const isProd = import.meta.env.PROD;

  const [logado, setLogado] = useState(null);
  const [tab, setTab] = useState("inventario");
  const [unidades, setUnidades] = useState([]);
  const [unidadeAtiva, setUnidadeAtiva] = useState(null);
  const [locais, setLocais] = useState([]);
  const [found, setFound] = useState([]);
  const [tombosNE, setTombosNE] = useState([]);
  const [tombosDup, setTombosDup] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [isMob, setIsMob] = useState(window.innerWidth < 768);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tombosTab, setTombosTab] = useState("ne");
  const [unidadeSearch, setUnidadeSearch] = useState("");
  const [itensSearch, setItensSearch] = useState("");
  const [itensFilterCat, setItensFilterCat] = useState("Todas");
  const [itensFilterEst, setItensFilterEst] = useState("Todos");
  const [itensFilterOrig, setItensFilterOrig] = useState("Todas");
  const [itensPage, setItensPage] = useState(1);
  const [loginError, setLoginError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [loginMode, setLoginMode] = useState("login");
  const [ft, setFt] = useState(0);

  const form = useRef({});
  const showT = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const uf = (k, v) => {
    form.current[k] = v;
  };
  const gf = (k) => form.current[k] || "";

  useEffect(() => {
    const h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setLoading(false);
        return;
      }
      try {
        const saved = localStorage.getItem("inv-session");
        if (saved) {
          const s = JSON.parse(saved);
          setFirebaseSession({ token: s.token, uid: s.uid });
          setLogado(s);
          const [unids] = await Promise.all([_loadXlsx(), _loadFirebase()]);
          try {
            const ativaId = localStorage.getItem("inv-ativa-id");
            if (ativaId && unids?.length) {
              const u = unids.find((x) => x.id === ativaId);
              if (u) setUnidadeAtiva(u);
            }
          } catch {}
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    boot();
  }, []);

  async function _loadXlsx(force = false) {
    setLoadingXlsx(true);
    try {
      const unids = await loadUnidades(force);
      setUnidades(unids);
      return unids;
    } catch (e) {
      showT("⚠️ Erro ao carregar patrimônios: " + e.message);
      return [];
    } finally {
      setLoadingXlsx(false);
    }
  }

  async function _loadFirebase() {
    try {
      const [foundDocs, localDocs, neDocs] = await Promise.all([fsGetAll("inventario"), fsGetAll("locais"), fsGetAll("tombosNE")]);
      setFound(foundDocs.map((d) => ({ ...d, patrimonioId: d.patrimonioId || d._id })));
      setLocais(localDocs.map((d) => ({ ...d, id: d._id })));
      setTombosNE(neDocs.map((d) => ({ ...d, id: d._id })));
    } catch (e) {
      console.error("Firebase load:", e);
    }
  }

  useEffect(() => {
    if (!logado) return;
    const id = setInterval(_loadFirebase, 30000);
    return () => clearInterval(id);
  }, [logado]);

  const handleLogin = async (email, senha) => {
    if (!firebaseOk) {
      setLoginError("Firebase não configurado.");
      return;
    }
    if (!email?.trim() || !senha?.trim()) {
      setLoginError("Preencha email e senha");
      return;
    }
    setLoginError("");
    try {
      const user = loginMode === "login" ? await fbLogin(email, senha) : await fbRegister(email, senha);
      setLogado(user);
      try {
        localStorage.setItem("inv-session", JSON.stringify(user));
      } catch {}
      setLoading(true);
      await Promise.all([_loadXlsx(), _loadFirebase()]);
      setLoading(false);
      showT(`Bem-vindo, ${user.nome}!`);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const saveAtiva = (u) => {
    setUnidadeAtiva(u);
    try {
      if (u) localStorage.setItem("inv-ativa-id", u.id);
      else localStorage.removeItem("inv-ativa-id");
    } catch {}
  };

  const markFound = async (itemId, estado, situacao, localId, obs, marca, origem, fotoUrls = []) => {
    const entry = {
      patrimonioId: itemId,
      estado,
      situacao,
      localId,
      obs,
      marca: marca || "",
      origem: origem || "Próprio",
      fotoUrls,
      data: new Date().toLocaleDateString("pt-BR"),
      user: logado?.nome || "",
    };
    await fsSet("inventario", itemId, entry);
    setFound((prev) => [...prev.filter((f) => f.patrimonioId !== itemId), { ...entry, _id: itemId }]);
  };

  const saveDetail = async () => {
    const item = form.current.detItem;
    if (!item) return;

    const existingUrls = form.current.detExistingUrls || [];
    const newBase64 = form.current.detNewBase64 || [];
    let allUrls = [...existingUrls];

    if (newBase64.length > 0) {
      if (isCloudinaryOk()) {
        setUploading(true);
        try {
          const newUrls = await uploadPhotos(newBase64, item.id, (done, total) => {
            setUploadMsg(`Enviando foto ${done}/${total}...`);
          });
          allUrls = [...allUrls, ...newUrls];
        } catch {
          showT("⚠️ Erro no upload das fotos");
        } finally {
          setUploading(false);
          setUploadMsg("");
        }
      } else {
        showT("⚠️ Firebase Storage não configurado — fotos não salvas");
      }
    }

    await markFound(item.id, gf("detEstado") || "Bom", gf("detSituacao") || "Em uso", gf("detLocal"), gf("detObs"), gf("detMarca"), gf("detOrigem") || "Próprio", allUrls);
    setModal(null);
    showT("✓ Salvo!");
  };

  const addLocal = async () => {
    const n = gf("localNome");
    if (!n.trim()) return;
    const id = `loc_${Date.now()}`;
    const localData = { nome: n.trim(), desc: gf("localDesc") };
    await fsSet("locais", id, localData);
    setLocais((prev) => [...prev, { id, _id: id, ...localData }]);
    setModal(null);
    showT("✓ Local criado!");
  };

  const delLocal = async (l) => {
    const id = l.id || l._id;
    await fsDel("locais", id);
    setLocais((prev) => prev.filter((x) => (x.id || x._id) !== id));
  };

  const addManual = async () => {
    const desc = gf("manDesc");
    if (!desc.trim()) {
      showT("Descrição obrigatória");
      return;
    }
    const id = `MAN_${Date.now()}`;
    const item = {
      id,
      data: new Date().toLocaleDateString("pt-BR"),
      especie: gf("manEspecie") || desc.split(" ")[0].toUpperCase(),
      descricao: desc.trim(),
      marca: gf("manMarca"),
      fornecedor: gf("manFornecedor"),
      empenho: "",
      nf: "",
      dataNF: "",
      valor: parseFloat(gf("manValor")) || 0,
      valorAtual: 0,
      isManual: true,
    };

    await fsSet("manuais", id, { ...item, unidadeId: unidadeAtiva?.id });

    let fotoUrls = [];
    if (form.current.manPhotos?.length && isCloudinaryOk()) {
      setUploading(true);
      try {
        fotoUrls = await uploadPhotos(form.current.manPhotos, id);
      } catch {} finally {
        setUploading(false);
      }
    }

    const novaAtiva = { ...unidadeAtiva, itens: [...unidadeAtiva.itens, item] };
    saveAtiva(novaAtiva);
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));

    await markFound(id, gf("manEstado") || "Bom", gf("manSituacao") || "Em uso", locais[0]?.id || "", desc.trim(), gf("manMarca"), gf("manOrigem") || "Próprio", fotoUrls);
    setModal(null);
    showT("✓ Item adicionado!");
  };

  const finalizarInv = async () => {
    const pendentes = (unidadeAtiva?.itens || []).filter((i) => !foundSet.has(i.id));
    for (const item of pendentes) {
      const ne = { patrimonioId: item.id, descricao: item.descricao, especie: item.especie, unidade: unidadeAtiva?.nome, dataFin: new Date().toLocaleDateString("pt-BR") };
      await fsSet("tombosNE", item.id, ne);
    }
    setTombosNE((prev) => [...prev, ...pendentes.map((i) => ({ ...i, unidade: unidadeAtiva?.nome, dataFin: new Date().toLocaleDateString("pt-BR") }))]);
    setModal(null);
    showT(`Finalizado! ${pendentes.length} não encontrado(s)`);
  };

  const openCamera = (target) => {
    setCameraTarget(target);
    setModal("camera");
  };

  const onCameraCapture = (photoArray) => {
    if (cameraTarget === "manual") {
      form.current.manPhotos = photoArray;
    } else {
      form.current.detNewBase64 = [...(form.current.detNewBase64 || []), ...photoArray];
    }
    setCameraTarget(null);
    setModal("detalhe");
    setFt((t) => t + 1);
  };

  const foundSet = new Set(found.map((f) => f.patrimonioId));
  const foundMap = found.reduce((m, f) => {
    m[f.patrimonioId] = f;
    return m;
  }, {});
  const allItens = unidadeAtiva?.itens || [];
  const totalBens = allItens.length;
  const totalFound = allItens.filter((i) => foundSet.has(i.id)).length;
  const progresso = totalBens > 0 ? Math.round((totalFound / totalBens) * 100) : 0;

  const filtered = allItens.filter((i) => {
    const s = search.toLowerCase();
    return !s || i.id.toLowerCase().includes(s) || (i.especie || "").toLowerCase().includes(s) || (i.descricao || "").toLowerCase().includes(s) || (i.fornecedor || "").toLowerCase().includes(s);
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const nfMap = allItens.reduce((m, i) => {
    if (i.nf) {
      if (!m[i.nf]) m[i.nf] = { nf: i.nf, fornecedor: i.fornecedor, itens: [], total: 0 };
      m[i.nf].itens.push(i);
      m[i.nf].total += i.valor || 0;
    }
    return m;
  }, {});

  const inp = { width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
  const bp = { background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
  const bs = { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const cd = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

  if (loading)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f1f5f9", gap: 16 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#1e3a8a", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 13 }}>Carregando inventário...</p>
      </div>
    );

  if (!logado)
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e3a8a,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📋 Inventário SEMCAS</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 24px" }}>{loginMode === "login" ? "Acesse sua conta" : "Criar nova conta"}</p>
          {!firebaseOk && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9a3412" }}>Firebase não configurado</p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9a3412" }}>{isProd ? "Configure os secrets no GitHub Actions e faça redeploy." : "Crie o arquivo .env com as variáveis do Firebase."}</p>
            </div>
          )}
          <TInput initial="" onVal={(v) => uf("email", v)} type="email" placeholder="Email" style={{ ...inp, marginBottom: 12 }} />
          <TInput initial="" onVal={(v) => uf("senha", v)} type="password" placeholder="Senha" style={{ ...inp, marginBottom: 8 }} />
          {loginError && <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 600, margin: "8px 0" }}>{loginError}</p>}
          <button disabled={!firebaseOk} onClick={() => handleLogin(gf("email"), gf("senha"))} style={{ ...bp, width: "100%", marginTop: 8, opacity: firebaseOk ? 1 : 0.6 }}>
            {loginMode === "login" ? "🔐 Entrar" : "📝 Criar conta"}
          </button>
          <button
            disabled={!firebaseOk}
            onClick={() => {
              setLoginMode((m) => (m === "login" ? "register" : "login"));
              setLoginError("");
            }}
            style={{ width: "100%", background: "none", border: "none", color: "#1e3a8a", fontSize: 13, cursor: "pointer", marginTop: 12, fontWeight: 600, opacity: firebaseOk ? 1 : 0.6 }}
          >
            {loginMode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Fazer login"}
          </button>
        </div>
      </div>
    );

  const Overlay = ({ children, onClose }) => (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: isMob ? "flex-end" : "center", justifyContent: "center" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: isMob ? "20px 20px 0 0" : 16, width: isMob ? "100%" : "520px", maxHeight: isMob ? "90vh" : "85vh", overflowY: "auto", padding: 24 }}>
        {children}
      </div>
    </div>
  );

  const Lbl = ({ children }) => <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>{children}</label>;

  const EGrid = ({ fk }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {ESTADOS.map((e) => (
        <button
          key={e}
          onClick={() => {
            form.current[fk] = e;
            setFt((t) => t + 1);
          }}
          style={{
            padding: "8px 4px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            border: `2px solid ${(form.current[fk] || "Bom") === e ? EC[e].tx : "#e2e8f0"}`,
            background: (form.current[fk] || "Bom") === e ? EC[e].bg : "#fff",
            color: (form.current[fk] || "Bom") === e ? EC[e].tx : "#6b7280",
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );

  const navs = [
    { id: "inventario", icon: "📦", l: "Inventário" },
    { id: "busca", icon: "🔍", l: "Busca" },
    { id: "itens", icon: "🪑", l: "Itens" },
    { id: "nf", icon: "🧾", l: "Notas" },
    { id: "tombos", icon: "🔖", l: "Tombos" },
    { id: "dash", icon: "📊", l: "Dashboard" },
    { id: "locais", icon: "📍", l: "Locais" },
  ];

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
          (item.nf || "").toLowerCase().includes(term)
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

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: "#1e3a8a", color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 200 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📋 Inventário SEMCAS</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>{logado.nome}{unidadeAtiva ? ` · ${unidadeAtiva.nome}` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {logado && (
            <button onClick={() => _loadXlsx(true)} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
              {loadingXlsx ? "⏳" : "🔄"}
            </button>
          )}
          <button
            onClick={() => {
              setLogado(null);
              clearFirebaseSession();
              try {
                localStorage.removeItem("inv-session");
              } catch {}
            }}
            style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Sair
          </button>
        </div>
      </div>

      {uploading && (
        <div style={{ background: "#1e40af", color: "#fff", padding: "8px 16px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>
          ☁️ {uploadMsg || "Enviando fotos..."}
        </div>
      )}

      <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto" }}>
        {!isMob && (
          <div style={{ width: 210, background: "#fff", borderRight: "1px solid #e2e8f0", padding: 16, flexShrink: 0 }}>
            {navs.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: tab === n.id ? "#1e3a8a" : "transparent", color: tab === n.id ? "#fff" : "#374151", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 4, textAlign: "left" }}
              >
                {n.icon} {n.l}
              </button>
            ))}
            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "12px 0" }} />
            <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>{isCloudinaryOk() ? "☁️ Fotos: Firebase Storage ✅" : "☁️ Fotos: Storage não configurado"}</p>
          </div>
        )}

        <div style={{ flex: 1, padding: isMob ? 12 : 24, paddingBottom: isMob ? 80 : 24 }}>
          {tab === "inventario" && !unidadeAtiva && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📦 Selecionar Unidade</h2>
                {loadingXlsx && <span style={{ fontSize: 12, color: "#64748b" }}>Carregando dados...</span>}
              </div>
              <TInput initial="" onVal={(v) => setUnidadeSearch(v)} placeholder="🔍 Buscar unidade..." style={{ ...inp, marginBottom: 12 }} />
              {unidades.length === 0 ? (
                <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 48 }}>📂</p>
                  <p style={{ color: "#94a3b8" }}>{loadingXlsx ? "Carregando patrimônios..." : "Nenhuma unidade carregada. Verifique o arquivo XLSX no servidor."}</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 10 }}>
                  {unidades
                    .filter((u) => !unidadeSearch || u.nome.toLowerCase().includes(unidadeSearch.toLowerCase()))
                    .map((u) => {
                      const inv = u.itens.filter((i) => foundSet.has(i.id)).length;
                      const pct = u.itens.length > 0 ? Math.round((inv / u.itens.length) * 100) : 0;
                      return (
                        <button key={u.id} onClick={() => { saveAtiva(u); setPage(1); }} style={{ ...cd, border: "1.5px solid #e2e8f0", cursor: "pointer", textAlign: "left", position: "relative", overflow: "hidden" }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{u.nome}</p>
                          <p style={{ margin: "4px 0 8px", fontSize: 12, color: "#64748b" }}>{u.itens.length} itens · {inv} inventariados</p>
                          <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0" }}>
                            <div style={{ height: "100%", background: pct === 100 ? "#16a34a" : "#1e3a8a", borderRadius: 2, width: `${pct}%`, transition: "width .3s" }} />
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {tab === "inventario" && unidadeAtiva && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{unidadeAtiva.nome}</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => { form.current = { manEstado: "Bom" }; setFt((t) => t + 1); setModal("manual"); }} style={{ ...bp, fontSize: 11, padding: "6px 12px", background: "#10b981" }}>
                    + Manual
                  </button>
                  {totalFound > 0 && (
                    <button onClick={() => setModal("finalizar")} style={{ ...bp, fontSize: 11, padding: "6px 12px", background: "#dc2626" }}>
                      ✓ Finalizar
                    </button>
                  )}
                  <button onClick={() => saveAtiva(null)} style={{ ...bs, fontSize: 11, padding: "6px 12px" }}>
                    Trocar
                  </button>
                </div>
              </div>

              <div style={{ ...cd, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Progresso</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>{totalFound}/{totalBens} ({progresso}%)</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0" }}>
                  <div style={{ height: "100%", background: progresso === 100 ? "#16a34a" : "#1e3a8a", borderRadius: 3, width: `${progresso}%`, transition: "width .3s" }} />
                </div>
              </div>

              <TInput initial="" onVal={(v) => { setSearch(v); setPage(1); }} placeholder="🔍 Buscar Nº, espécie, descrição..." style={{ ...inp, marginBottom: 8 }} />

              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(380px,1fr))", gap: 10 }}>
                {paged.map((item) => {
                  const f = foundMap[item.id];
                  const isF = !!f;
                  const foto = f?.fotoUrls?.[0];
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        form.current = {
                          detItem: item,
                          detEstado: f?.estado || "Bom",
                          detSituacao: f?.situacao || "Em uso",
                          detLocal: f?.localId || "",
                          detObs: f?.obs || "",
                          detMarca: f?.marca || item.marca || "",
                          detOrigem: f?.origem || "Próprio",
                          detExistingUrls: f?.fotoUrls || [],
                          detNewBase64: [],
                        };
                        setFt((t) => t + 1);
                        setModal("detalhe");
                      }}
                      style={{ ...cd, cursor: "pointer", border: `1.5px solid ${isF ? "#bbf7d0" : "#e2e8f0"}`, display: "flex", gap: 12 }}
                    >
                      {foto ? <img src={foto} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 56, height: 56, borderRadius: 8, background: isF ? "#f0fdf4" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{isF ? "✅" : "📷"}</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{item.descricao || item.especie || "—"}</p>
                        <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>Nº {item.id} · {item.data} · R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#94a3b8" }}>{item.fornecedor || "—"}{item.marca ? ` · ${item.marca}` : ""}{item.nf ? ` · NF ${item.nf}` : ""}</p>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {isF ? (
                            <>
                              <Badge label={f.estado} c={EC[f.estado]} />
                              <Badge label={f.situacao} c={SC[f.situacao]} />
                            </>
                          ) : (
                            <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                  <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                    «
                  </button>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                    ‹
                  </button>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Pág {page}/{totalPages} · {filtered.length} itens</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                    ›
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                    »
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "busca" && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>🔍 Busca</h2>
              <TInput
                initial=""
                onVal={(v) => {
                  setGlobalSearch(v);
                  clearTimeout(form.current._gsT);
                  form.current._gsT = setTimeout(() => doGlobalSearch(v), 300);
                }}
                placeholder="Buscar em todas as unidades (mín. 2 caracteres)..."
                style={{ ...inp, marginBottom: 12 }}
              />
              {globalSearching && <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>Buscando...</p>}
              {!globalSearching && globalSearch.trim().length >= 2 && (
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>{globalResults.length} resultado(s)</p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px,1fr))", gap: 10 }}>
                {globalResults.map((item) => (
                  <div
                    key={`${item.unidadeId}_${item.id}`}
                    onClick={() => {
                      const u = unidades.find((x) => x.id === item.unidadeId);
                      if (u) saveAtiva(u);
                      form.current = { detItem: item, detEstado: foundMap[item.id]?.estado || "Bom", detSituacao: foundMap[item.id]?.situacao || "Em uso", detLocal: foundMap[item.id]?.localId || "", detObs: foundMap[item.id]?.obs || "", detMarca: foundMap[item.id]?.marca || item.marca || "", detOrigem: foundMap[item.id]?.origem || "Próprio", detExistingUrls: foundMap[item.id]?.fotoUrls || [], detNewBase64: [] };
                      setFt((t) => t + 1);
                      setModal("detalhe");
                    }}
                    style={{ ...cd, cursor: "pointer" }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{item.descricao || item.especie || "—"}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Nº {item.id} · {item.unidadeNome}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "itens" && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>🪑 Itens</h2>
              {(() => {
                const categorias = ["Todas", ...Array.from(new Set(allItens.map((i) => i.especie || "OUTROS"))).sort()];
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "2fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <TInput initial="" onVal={(v) => { setItensSearch(v); setItensPage(1); }} placeholder="🔍 Buscar item..." style={inp} />
                      <select value={itensFilterCat} onChange={(e) => { setItensFilterCat(e.target.value); setItensPage(1); }} style={inp}>
                        {categorias.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <select value={itensFilterEst} onChange={(e) => { setItensFilterEst(e.target.value); setItensPage(1); }} style={inp}>
                        <option>Todos</option>
                        {ESTADOS.map((e) => (
                          <option key={e}>{e}</option>
                        ))}
                      </select>
                      <select value={itensFilterOrig} onChange={(e) => { setItensFilterOrig(e.target.value); setItensPage(1); }} style={inp}>
                        <option>Todas</option>
                        <option>Próprio</option>
                        <option>Doação</option>
                        <option>Permuta</option>
                      </select>
                    </div>
                    {(() => {
                      const filteredItens = allItens.filter((item) => {
                        const s = itensSearch.toLowerCase();
                        const f = foundMap[item.id];
                        return (
                          (!s || item.id.toLowerCase().includes(s) || (item.especie || "").toLowerCase().includes(s) || (item.descricao || "").toLowerCase().includes(s) || (item.marca || "").toLowerCase().includes(s)) &&
                          (itensFilterCat === "Todas" || (item.especie || "OUTROS") === itensFilterCat) &&
                          (itensFilterEst === "Todos" || f?.estado === itensFilterEst) &&
                          (itensFilterOrig === "Todas" || (f?.origem || "Próprio") === itensFilterOrig)
                        );
                      });
                      const itensTotalPages = Math.ceil(filteredItens.length / PER_PAGE);
                      const pagedItens = filteredItens.slice((itensPage - 1) * PER_PAGE, itensPage * PER_PAGE);
                      return (
                        <>
                          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>{filteredItens.length} item(s) encontrado(s)</p>
                          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                            {pagedItens.map((item) => {
                              const f = foundMap[item.id];
                              const ph = f?.fotoUrls?.[0];
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    form.current = { detItem: item, detEstado: f?.estado || "Bom", detSituacao: f?.situacao || "Em uso", detLocal: f?.localId || "", detObs: f?.obs || "", detMarca: f?.marca || item.marca || "", detOrigem: f?.origem || "Próprio", detExistingUrls: f?.fotoUrls || [], detNewBase64: [] };
                                    setFt((t) => t + 1);
                                    setModal("detalhe");
                                  }}
                                  style={{ ...cd, cursor: "pointer", padding: 0, overflow: "hidden" }}
                                >
                                  {ph ? <img src={ph} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: 140, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, color: "#94a3b8" }}><span style={{ fontSize: 32 }}>📷</span><span style={{ fontSize: 10, fontWeight: 600 }}>SEM FOTO</span></div>}
                                  <div style={{ padding: 12 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.descricao || item.especie || "—"}</p>
                                    <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>Nº {item.id}</p>
                                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "#94a3b8" }}>{item.marca || foundMap[item.id]?.marca || "Sem marca"} · R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {f ? (
                                        <>
                                          <Badge label={f.estado} c={EC[f.estado]} />
                                          <Badge label={f.origem || "Próprio"} c={f.origem === "Doação" ? { bg: "#fef3c7", tx: "#92400e" } : { bg: "#dbeafe", tx: "#1d4ed8" }} />
                                        </>
                                      ) : (
                                        <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {itensTotalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
                              <button onClick={() => setItensPage((p) => Math.max(1, p - 1))} disabled={itensPage === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                                ‹
                              </button>
                              <span style={{ fontSize: 12, color: "#64748b" }}>Pág {itensPage}/{itensTotalPages}</span>
                              <button onClick={() => setItensPage((p) => Math.min(itensTotalPages, p + 1))} disabled={itensPage === itensTotalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>
                                ›
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          )}

          {tab === "nf" && (
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>🧾 Notas Fiscais</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
                {Object.values(nfMap).sort((a, b) => b.total - a.total).map((n) => (
                  <div key={n.nf} style={cd}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>NF {n.nf}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>{n.fornecedor}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#16a34a" }}>R$ {n.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 6 }}>
                      {n.itens.slice(0, 5).map((i) => (
                        <p key={i.id} style={{ margin: "2px 0", fontSize: 11, color: "#374151" }}>
                          {i.id} — {i.descricao || i.especie}
                        </p>
                      ))}
                      {n.itens.length > 5 && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>+{n.itens.length - 5} mais</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "tombos" && (
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>🔖 Tombos</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={() => setTombosTab("ne")} style={{ ...(tombosTab === "ne" ? bp : bs), fontSize: 12 }}>
                  ❌ Não Encontrados ({tombosNE.length})
                </button>
                <button onClick={() => setTombosTab("dup")} style={{ ...(tombosTab === "dup" ? bp : bs), fontSize: 12 }}>
                  🔄 Duplicados ({tombosDup.length})
                </button>
              </div>
              {tombosTab === "ne" &&
                (tombosNE.length === 0 ? (
                  <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                    <p style={{ fontSize: 48 }}>✅</p>
                    <p style={{ color: "#94a3b8" }}>Nenhum</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
                    {tombosNE.map((i, idx) => (
                      <div key={idx} style={{ ...cd, border: "1.5px solid #fca5a5" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{i.descricao || i.especie}</p>
                        <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>Nº {i.id} · {i.unidade}</p>
                      </div>
                    ))}
                  </div>
                ))}
              {tombosTab === "dup" &&
                (tombosDup.length === 0 ? (
                  <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                    <p style={{ fontSize: 48 }}>🔄</p>
                    <p style={{ color: "#94a3b8" }}>Detecção automática ao importar relatórios</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
                    {tombosDup.map((i, idx) => (
                      <div key={idx} style={{ ...cd, border: "1.5px solid #c084fc" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>{i.descricao || i.especie}</p>
                        <p style={{ fontSize: 11, color: "#dc2626" }}>Pertence: {i.unidadeOrigem}</p>
                        <p style={{ fontSize: 11, color: "#16a34a" }}>Encontrado: {i.unidadeEncontrada}</p>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}

          {tab === "dash" && (
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>📊 Dashboard</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {[{ l: "Total", v: totalBens, c: "#1e3a8a" }, { l: "Encontrados", v: totalFound, c: "#16a34a" }, { l: "Pendentes", v: totalBens - totalFound, c: "#dc2626" }, { l: "Progresso", v: `${progresso}%`, c: "#7c3aed" }].map((s) => (
                  <div key={s.l} style={cd}>
                    <p style={{ margin: 0, fontSize: isMob ? 20 : 28, fontWeight: 700, color: s.c }}>{s.v}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{s.l}</p>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Estado de Conservação</h3>
              <div style={cd}>
                {(() => {
                  const ec = found.reduce((a, f) => {
                    a[f.estado] = (a[f.estado] || 0) + 1;
                    return a;
                  }, {});
                  return Object.entries(ec).length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: 13 }}>Sem dados</p>
                  ) : (
                    Object.entries(ec).map(([e, c]) => (
                      <div key={e} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                        <Badge label={e} c={EC[e]} />
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: "#e2e8f0" }}>
                          <div style={{ height: "100%", background: EC[e].tx, borderRadius: 3, width: `${(c / found.length) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{c}</span>
                      </div>
                    ))
                  );
                })()}
              </div>
            </div>
          )}

          {tab === "locais" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📍 Locais</h2>
                <button onClick={() => { form.current = {}; setModal("addLocal"); }} style={bp}>
                  + Novo
                </button>
              </div>
              {locais.length === 0 ? (
                <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 48 }}>📍</p>
                  <p style={{ color: "#94a3b8" }}>Cadastre locais</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {locais.map((l) => {
                    const c = found.filter((f) => f.localId === l.id).length;
                    return (
                      <div key={l.id} style={{ ...cd, display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>📍 {l.nome}</p>
                          {l.desc && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>{l.desc}</p>}
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{c} item(s)</p>
                        </div>
                        <button
                          onClick={() => {
                            if (c > 0) {
                              showT("Remova itens antes");
                              return;
                            }
                            delLocal(l);
                          }}
                          style={{ border: "none", background: "#fff0f0", color: "#dc2626", borderRadius: 7, padding: "6px 10px", cursor: "pointer" }}
                        >
                          🗑
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isMob && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1.5px solid #e2e8f0", display: "flex", zIndex: 200 }}>
          {navs.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, padding: "8px 2px 6px", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 400, color: tab === n.id ? "#1e3a8a" : "#94a3b8" }}>{n.l}</span>
            </button>
          ))}
        </div>
      )}

      {modal === "camera" && <CameraModal existingPhotos={cameraTarget === "manual" ? form.current.manPhotos || [] : form.current.detNewBase64 || []} onCapture={onCameraCapture} onClose={() => { setCameraTarget(null); setModal(form.current.detItem ? "detalhe" : null); }} />}

      {modal === "detalhe" && form.current.detItem && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>{form.current.detItem.descricao || form.current.detItem.especie || "—"}</h2>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>Nº {form.current.detItem.id} · {form.current.detItem.data} · R$ {(form.current.detItem.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>Fornecedor: {form.current.detItem.fornecedor || "—"} · Marca: {form.current.detItem.marca || "—"} · NF: {form.current.detItem.nf || "—"} · Empenho: {form.current.detItem.empenho || "—"}</p>

          {(() => {
            const photoList = [...(form.current.detExistingUrls || []), ...(form.current.detNewBase64 || [])];
            return (
              <div style={{ marginBottom: 14 }}>
                {photoList.length > 0 ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                      {photoList.map((ph, i) => (
                        <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                          <img src={ph} alt="" style={{ width: photoList.length === 1 ? "100%" : 200, height: photoList.length === 1 ? 180 : 140, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }} />
                          <button
                            onClick={() => {
                              const existing = form.current.detExistingUrls || [];
                              const newb64 = form.current.detNewBase64 || [];
                              if (i < existing.length) {
                                const url = existing[i];
                                form.current.detExistingUrls = existing.filter((_, j) => j !== i);
                                deletePhoto(url);
                              } else {
                                const idx = i - existing.length;
                                form.current.detNewBase64 = newb64.filter((_, j) => j !== idx);
                              }
                              setFt((t) => t + 1);
                            }}
                            style={{ position: "absolute", top: 4, right: 4, background: "rgba(220,38,38,.85)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => openCamera("detalhe")} style={{ width: "100%", border: "1.5px dashed #93c5fd", background: "#eff6ff", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13, color: "#1d4ed8", fontWeight: 600, marginTop: 4 }}>
                      📷 Adicionar mais fotos ({photoList.length})
                    </button>
                  </div>
                ) : (
                  <button onClick={() => openCamera("detalhe")} style={{ width: "100%", border: "2px dashed #cbd5e1", background: "#f8fafc", borderRadius: 12, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 36 }}>📷</span>
                    <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Tirar fotos do patrimônio</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Item, plaqueta, estado de conservação</span>
                  </button>
                )}
              </div>
            );
          })()}

          <Lbl>📍 Local</Lbl>
          <select defaultValue={form.current.detLocal} onChange={(e) => uf("detLocal", e.target.value)} style={inp}>
            <option value="">— Sem local —</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          <Lbl>Origem</Lbl>
          <div style={{ display: "flex", gap: 8 }}>
            {["Próprio", "Doação", "Permuta"].map((o) => (
              <button key={o} onClick={() => { form.current.detOrigem = o; setFt((t) => t + 1); }} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `2px solid ${(form.current.detOrigem || "Próprio") === o ? "#1e3a8a" : "#e2e8f0"}`, background: (form.current.detOrigem || "Próprio") === o ? "#dbeafe" : "#fff", color: (form.current.detOrigem || "Próprio") === o ? "#1e3a8a" : "#6b7280" }}>
                {o === "Próprio" ? "🏛️ Próprio" : o === "Doação" ? "🎁 Doação" : "🔄 Permuta"}
              </button>
            ))}
          </div>
          <Lbl>Marca (se diferente do relatório)</Lbl>
          <TInput initial={form.current.detMarca} onVal={(v) => uf("detMarca", v)} placeholder="Ex: Tramontina..." style={inp} />
          <Lbl>Estado de Conservação</Lbl>
          <EGrid fk="detEstado" />
          <Lbl>Situação</Lbl>
          <select defaultValue={form.current.detSituacao} onChange={(e) => uf("detSituacao", e.target.value)} style={inp}>
            {SITUACOES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Lbl>Observações</Lbl>
          <TArea initial={form.current.detObs} onVal={(v) => uf("detObs", v)} rows={2} placeholder="Anotações..." style={{ ...inp, resize: "none" }} />
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            {foundSet.has(form.current.detItem.id) && (
              <button
                onClick={async () => {
                  await fsDel("inventario", form.current.detItem.id);
                  setFound(found.filter((f) => f.patrimonioId !== form.current.detItem.id));
                  setModal(null);
                  showT("Removido");
                }}
                style={{ ...bs, flex: 1, color: "#dc2626" }}
              >
                🗑
              </button>
            )}
            <button onClick={saveDetail} style={{ ...bp, flex: 1 }}>
              ✓ {foundSet.has(form.current.detItem.id) ? "Salvar" : "Encontrado"}
            </button>
          </div>
        </Overlay>
      )}

      {modal === "manual" && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Adicionar Manual</h2>
          <Lbl>Descrição *</Lbl>
          <TArea key="manDesc" initial={gf("manDesc")} onVal={(v) => uf("manDesc", v)} rows={3} placeholder="Descreva o item..." style={{ ...inp, resize: "none" }} />
          <Lbl>Espécie</Lbl>
          <TInput key={"manEsp_" + ft} initial={gf("manEspecie")} onVal={(v) => uf("manEspecie", v)} placeholder="Ex: CADEIRA" style={inp} />
          <Lbl>Marca</Lbl>
          <TInput key="manMarca" initial={gf("manMarca")} onVal={(v) => uf("manMarca", v)} placeholder="Marca..." style={inp} />
          <Lbl>Fornecedor</Lbl>
          <TInput key="manForn" initial={gf("manFornecedor")} onVal={(v) => uf("manFornecedor", v)} placeholder="Fornecedor..." style={inp} />
          <Lbl>Valor</Lbl>
          <TInput key="manVal" initial={gf("manValor")} onVal={(v) => uf("manValor", v)} type="number" placeholder="0.00" style={inp} />
          <Lbl>Origem</Lbl>
          <div style={{ display: "flex", gap: 8 }}>
            {["Próprio", "Doação", "Permuta"].map((o) => (
              <button key={o} onClick={() => { form.current.manOrigem = o; setFt((t) => t + 1); }} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `2px solid ${(form.current.manOrigem || "Próprio") === o ? "#1e3a8a" : "#e2e8f0"}`, background: (form.current.manOrigem || "Próprio") === o ? "#dbeafe" : "#fff", color: (form.current.manOrigem || "Próprio") === o ? "#1e3a8a" : "#6b7280" }}>
                {o === "Próprio" ? "🏛️ Próprio" : o === "Doação" ? "🎁 Doação" : "🔄 Permuta"}
              </button>
            ))}
          </div>
          <Lbl>Estado de Conservação</Lbl>
          <EGrid fk="manEstado" />
          <Lbl>Situação</Lbl>
          <select key="manSit" defaultValue={gf("manSituacao") || "Em uso"} onChange={(e) => uf("manSituacao", e.target.value)} style={inp}>
            {SITUACOES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Lbl>Fotos</Lbl>
          {form.current.manPhotos?.length > 0 ? (
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {form.current.manPhotos.map((ph, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={ph} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6 }} />
                    <button onClick={() => { form.current.manPhotos = form.current.manPhotos.filter((_, j) => j !== i); setFt((t) => t + 1); }} style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, fontSize: 9, cursor: "pointer" }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => { setCameraTarget("manual"); setModal("camera"); }} style={{ width: "100%", border: "1.5px dashed #93c5fd", background: "#eff6ff", borderRadius: 8, padding: 8, cursor: "pointer", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
                + Mais fotos
              </button>
            </div>
          ) : (
            <button onClick={() => { setCameraTarget("manual"); setModal("camera"); }} style={{ width: "100%", border: "2px dashed #cbd5e1", background: "#f8fafc", borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
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
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Novo Local</h2>
          <Lbl>Nome *</Lbl>
          <TInput initial="" onVal={(v) => uf("localNome", v)} placeholder="Ex: Sala de Reunião..." style={inp} />
          <Lbl>Descrição</Lbl>
          <TInput initial="" onVal={(v) => uf("localDesc", v)} placeholder="Andar, ala..." style={inp} />
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button onClick={addLocal} style={{ ...bp, flex: 1 }}>
              Criar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "finalizar" && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 48, margin: "0 0 16px" }}>⚠️</p>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Finalizar?</h2>
            <p style={{ color: "#64748b", margin: "0 0 16px" }}>{unidadeAtiva?.nome}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#16a34a" }}>{totalFound}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Encontrados</p>
              </div>
              <div style={{ background: "#fef2f2", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#dc2626" }}>{totalBens - totalFound}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Não encontrados</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={finalizarInv} style={{ ...bp, flex: 1, background: "#dc2626" }}>
                ✓ Finalizar
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {toast && <div style={{ position: "fixed", bottom: isMob ? 82 : 24, left: "50%", transform: "translateX(-50%)", background: "#1e3a8a", color: "#fff", padding: "11px 24px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 400, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>{toast}</div>}
    </div>
  );
}

