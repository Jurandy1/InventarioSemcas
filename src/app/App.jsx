import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Badge } from "../components/Badge.jsx";
import { CameraModal } from "../components/CameraModal.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import { EC, ESTADOS, PER_PAGE, SC, SITUACOES } from "../constants/inventory.js";
import { fbLogin, fbRegister, clearFirebaseSession, fsDel, fsGet, fsSet, isFirebaseConfigured, setFirebaseSession } from "../services/firebase.js";
import { parseXLSXFile } from "../utils/xlsx.js";

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
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [isMob, setIsMob] = useState(window.innerWidth < 768);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [search, setSearch] = useState("");
  const [filterEsp, setFilterEsp] = useState("Todas");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [tombosTab, setTombosTab] = useState("ne");
  const [unidadeSearch, setUnidadeSearch] = useState("");
  const [itensSearch, setItensSearch] = useState("");
  const [itensFilterCat, setItensFilterCat] = useState("Todas");
  const [itensFilterEstado, setItensFilterEstado] = useState("Todos");
  const [itensFilterOrigem, setItensFilterOrigem] = useState("Todas");
  const [itensPage, setItensPage] = useState(1);
  const form = useRef({});
  const [ft, setFt] = useState(0);
  const fileRef = useRef(null);

  const [loginError, setLoginError] = useState("");
  const [loginMode, setLoginMode] = useState("login");

  const showT = (m) => {
    setToast(m);
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
    async function load() {
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
          try {
            const a = localStorage.getItem("inv-ativa");
            if (a) setUnidadeAtiva(JSON.parse(a));
          } catch {}
          await loadFirebaseData();
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const loadFirebaseData = async () => {
    try {
      const d = await fsGet("appdata", "main");
      if (d) {
        if (d.unidades) setUnidades(d.unidades);
        if (d.locais) setLocais(d.locais);
        if (d.found) setFound(d.found);
        if (d.tombosNE) setTombosNE(d.tombosNE);
        if (d.tombosDup) setTombosDup(d.tombosDup);
      }
    } catch {}
  };

  useEffect(() => {
    if (!logado) return;
    const id = setInterval(loadFirebaseData, 20000);
    return () => clearInterval(id);
  }, [logado]);

  const saveToFirebase = async (updates) => {
    try {
      const current = (await fsGet("appdata", "main")) || {};
      await fsSet("appdata", "main", { ...current, ...updates });
    } catch (err) {
      console.error("Firebase save error:", err);
    }
  };

  const saveUnidades = async (d) => {
    setUnidades(d);
    await saveToFirebase({ unidades: d });
  };
  const saveAtiva = async (d) => {
    setUnidadeAtiva(d);
    try {
      localStorage.setItem("inv-ativa", JSON.stringify(d));
    } catch {}
  };
  const saveLocais = async (d) => {
    setLocais(d);
    await saveToFirebase({ locais: d });
  };
  const saveFound = async (d) => {
    setFound(d);
    await saveToFirebase({ found: d });
  };
  const saveTNE = async (d) => {
    setTombosNE(d);
    await saveToFirebase({ tombosNE: d });
  };
  const saveTDup = async (d) => {
    setTombosDup(d);
    await saveToFirebase({ tombosDup: d });
  };
  const savePhotos = async (k, arr) => {
    setPhotos((p) => ({ ...p, [k]: arr }));
    try {
      await fsSet("photos", k, { data: arr });
    } catch {}
  };
  const delPhotos = async (k) => {
    setPhotos((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
    try {
      await fsDel("photos", k);
    } catch {}
  };

  const handleLogin = async (email, senha) => {
    if (!firebaseOk) {
      setLoginError(
        isProd
          ? "Firebase não configurado no deploy. Configure os secrets do GitHub Actions e faça um redeploy."
          : "Firebase não configurado. Crie um arquivo .env e reinicie o servidor.",
      );
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
      await loadFirebaseData();
      showT(`Bem-vindo, ${user.nome}!`);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadStatus("Lendo arquivo...");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const parsed = parseXLSXFile(wb);
      if (!parsed.length) {
        setUploadStatus("Nenhuma unidade encontrada");
        return;
      }
      parsed.forEach((u) => {
        u.total = u.itens.length;
        u.dataCriacao = new Date().toLocaleDateString("pt-BR");
      });
      await saveUnidades([...unidades, ...parsed]);
      setUploadStatus("");
      setModal(null);
      showT(`✓ ${parsed.length} unidade(s), ${parsed.reduce((s, u) => s + u.itens.length, 0)} itens!`);
    } catch (err) {
      setUploadStatus(err.message);
    }
    e.target.value = "";
  };

  const openCamera = (itemId) => {
    setCameraTarget(itemId);
    setModal("camera");
  };

  const onCameraCapture = async (photoArray) => {
    if (cameraTarget === "manual") {
      form.current.manPhotos = photoArray;
      setFt((t) => t + 1);
    } else if (cameraTarget && photoArray.length > 0) {
      await savePhotos(cameraTarget, photoArray);
      setFt((t) => t + 1);
    }
    setCameraTarget(null);
    setModal("detalhe");
  };

  const markFound = async (itemId, estado, situacao, localId, obs, marca, origem) => {
    const entry = {
      patrimonioId: itemId,
      estado,
      situacao,
      localId,
      obs,
      marca: marca || "",
      origem: origem || "Próprio",
      data: new Date().toLocaleDateString("pt-BR"),
      user: logado?.nome || "",
    };
    await saveFound([...found.filter((f) => f.patrimonioId !== itemId), entry]);
  };

  const saveDetail = async () => {
    const item = form.current.detItem;
    if (!item) return;
    await markFound(
      item.id,
      gf("detEstado") || "Bom",
      gf("detSituacao") || "Em uso",
      gf("detLocal"),
      gf("detObs"),
      gf("detMarca"),
      gf("detOrigem") || "Próprio",
    );
    setModal(null);
    showT("✓ Salvo!");
  };

  const addManual = async () => {
    const desc = gf("manDesc");
    if (!desc.trim()) {
      showT("Descrição obrigatória");
      return;
    }
    const especie = gf("manEspecie") || desc.split(" ")[0].toUpperCase();
    const id = `MAN_${Date.now()}`;
    const item = {
      id,
      data: new Date().toLocaleDateString("pt-BR"),
      especie,
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
    const ativa = unidadeAtiva;
    ativa.itens = [...ativa.itens, item];
    ativa.total = ativa.itens.length;
    await saveAtiva({ ...ativa });
    await saveUnidades(unidades.map((u) => (u.id === ativa.id ? ativa : u)));
    if (form.current.manPhotos?.length) await savePhotos(id, form.current.manPhotos);
    await markFound(
      id,
      gf("manEstado") || "Bom",
      gf("manSituacao") || "Em uso",
      locais[0]?.id || "",
      desc.trim(),
      gf("manMarca"),
      gf("manOrigem") || "Próprio",
    );
    setModal(null);
    showT("✓ Item adicionado!");
  };

  const addLocal = async () => {
    const n = gf("localNome");
    if (!n.trim()) return;
    await saveLocais([...locais, { id: `loc_${Date.now()}`, nome: n.trim(), desc: gf("localDesc") }]);
    setModal(null);
    showT("✓ Local criado!");
  };

  const foundSet = new Set(found.map((f) => f.patrimonioId));

  const finalizarInv = async () => {
    const pendentes = (unidadeAtiva?.itens || []).filter((i) => !foundSet.has(i.id));
    const ne = pendentes.map((i) => ({ ...i, unidade: unidadeAtiva?.nome, dataFin: new Date().toLocaleDateString("pt-BR") }));
    await saveTNE([...tombosNE, ...ne]);
    setModal(null);
    showT(`Finalizado! ${ne.length} não encontrado(s)`);
  };

  const allItens = unidadeAtiva?.itens || [];
  const foundMap = found.reduce((m, f) => {
    m[f.patrimonioId] = f;
    return m;
  }, {});
  const especies = ["Todas", ...new Set(allItens.map((i) => i.especie || i.descricao).filter(Boolean))];
  const totalBens = allItens.length;
  const totalFound = allItens.filter((i) => foundSet.has(i.id)).length;
  const progresso = totalBens > 0 ? Math.round((totalFound / totalBens) * 100) : 0;

  const filtered = allItens.filter((i) => {
    const s = search.toLowerCase();
    return (
      (!s ||
        i.id.toLowerCase().includes(s) ||
        (i.especie || "").toLowerCase().includes(s) ||
        (i.descricao || "").toLowerCase().includes(s) ||
        (i.fornecedor || "").toLowerCase().includes(s)) &&
      (filterEsp === "Todas" || i.especie === filterEsp || i.descricao === filterEsp)
    );
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

  const THEME = {
    bg: "#f4f6f9",
    surface: "#ffffff",
    border: "#d5dde8",
    text: "#0b1220",
    muted: "#526173",
    primary: "#0b2e59",
    primaryHover: "#0a396d",
    danger: "#b42318",
    dangerHover: "#8a1c12",
    success: "#067647",
    warningBg: "#fffaeb",
    warningBorder: "#fedf89",
    warningText: "#7a2e0e",
    radius: 10,
    radiusSm: 8,
    shadow: "0 1px 2px rgba(16,24,40,.06), 0 2px 8px rgba(16,24,40,.08)",
  };

  const inp = {
    width: "100%",
    border: `1px solid ${THEME.border}`,
    borderRadius: THEME.radiusSm,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    boxSizing: "border-box",
    outline: "none",
    color: THEME.text,
    background: THEME.surface,
  };
  const bp = {
    background: THEME.primary,
    color: "#fff",
    border: "1px solid transparent",
    borderRadius: THEME.radiusSm,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
  const bs = {
    background: THEME.surface,
    color: THEME.text,
    border: `1px solid ${THEME.border}`,
    borderRadius: THEME.radiusSm,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
  const cd = {
    background: THEME.surface,
    borderRadius: THEME.radius,
    padding: 16,
    boxShadow: THEME.shadow,
    border: `1px solid ${THEME.border}`,
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: THEME.bg }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, border: `4px solid ${THEME.border}`, borderTopColor: THEME.primary, borderRadius: "50%", animation: "sp .8s linear infinite" }} />
      </div>
    );
  }

  if (!logado) {
    return (
      <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ background: THEME.surface, borderRadius: THEME.radius, border: `1px solid ${THEME.border}`, boxShadow: THEME.shadow, overflow: "hidden" }}>
            <div style={{ background: THEME.primary, color: "#fff", padding: "16px 18px" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: 0.2 }}>INVENTÁRIO SEMCAS</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>Sistema de Inventário Patrimonial</p>
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ color: THEME.muted, fontSize: 13, margin: "2px 0 16px", fontWeight: 600 }}>{loginMode === "login" ? "Acesso ao sistema" : "Criar nova conta"}</p>
          {!firebaseOk && (
            <div style={{ background: THEME.warningBg, border: `1px solid ${THEME.warningBorder}`, borderRadius: THEME.radiusSm, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: THEME.warningText }}>Configuração do Firebase ausente</p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: THEME.warningText, lineHeight: 1.35 }}>
                {isProd ? (
                  <>
                    Configure os secrets do GitHub Actions: <span style={{ fontWeight: 700 }}>VITE_FB_API_KEY</span>, <span style={{ fontWeight: 700 }}>VITE_FB_PROJECT_ID</span> e <span style={{ fontWeight: 700 }}>VITE_FB_STORAGE_BUCKET</span>, e faça um redeploy no GitHub Pages.
                  </>
                ) : (
                  <>
                    Crie um arquivo <span style={{ fontWeight: 700 }}>.env</span> na raiz do projeto com <span style={{ fontWeight: 700 }}>VITE_FB_API_KEY</span>, <span style={{ fontWeight: 700 }}>VITE_FB_PROJECT_ID</span> e <span style={{ fontWeight: 700 }}>VITE_FB_STORAGE_BUCKET</span>, e reinicie o <span style={{ fontWeight: 700 }}>npm run dev</span>.
                  </>
                )}
              </p>
            </div>
          )}
          <TInput initial="" onVal={(v) => uf("email", v)} type="email" placeholder="Email" style={{ ...inp, marginBottom: 12 }} />
          <TInput initial="" onVal={(v) => uf("senha", v)} type="password" placeholder="Senha (mín. 6 caracteres)" style={{ ...inp, marginBottom: 8 }} />
          {loginError && <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 600, margin: "8px 0" }}>{loginError}</p>}
          <button disabled={!firebaseOk} onClick={() => handleLogin(gf("email"), gf("senha"))} style={{ ...bp, width: "100%", marginTop: 8, opacity: firebaseOk ? 1 : 0.6, cursor: firebaseOk ? "pointer" : "not-allowed" }}>
            {loginMode === "login" ? "Entrar" : "Criar conta"}
          </button>
          <button
            disabled={!firebaseOk}
            onClick={() => {
              setLoginMode(loginMode === "login" ? "register" : "login");
              setLoginError("");
            }}
            style={{ width: "100%", background: "none", border: "none", color: THEME.primary, fontSize: 13, cursor: firebaseOk ? "pointer" : "not-allowed", marginTop: 12, fontWeight: 700, opacity: firebaseOk ? 1 : 0.6 }}
          >
            {loginMode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Fazer login"}
          </button>
            </div>
          </div>
          <p style={{ margin: "12px 2px 0", fontSize: 11, color: THEME.muted }}>Uso restrito a usuários autorizados.</p>
        </div>
      </div>
    );
  }

  const Overlay = ({ children, onClose }) => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: isMob ? "flex-end" : "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: isMob ? "20px 20px 0 0" : 16, width: isMob ? "100%" : "520px", maxHeight: isMob ? "90vh" : "85vh", overflowY: "auto", padding: 24 }}>
        {children}
      </div>
    </div>
  );

  const Lbl = ({ children }) => <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>{children}</label>;

  const EGrid = ({ fk }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
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
    { id: "inventario", l: "Inventário" },
    { id: "itens", l: "Itens" },
    { id: "nf", l: "Notas Fiscais" },
    { id: "tombos", l: "Tombos" },
    { id: "dash", l: "Painel" },
    { id: "locais", l: "Locais" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg }}>
      <div style={{ background: THEME.primary, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 200 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: 0.2 }}>INVENTÁRIO SEMCAS</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.85 }}>{logado.nome}{unidadeAtiva ? ` · ${unidadeAtiva.nome}` : ""}</p>
        </div>
        <button
          onClick={() => {
            setLogado(null);
            clearFirebaseSession();
            try {
              localStorage.removeItem("inv-session");
            } catch {}
          }}
          style={{ background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.22)", borderRadius: THEME.radiusSm, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
        >
          Sair
        </button>
      </div>

      <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto" }}>
        {!isMob && (
          <div style={{ width: 230, background: THEME.surface, borderRight: `1px solid ${THEME.border}`, padding: 16, flexShrink: 0 }}>
            {navs.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  background: tab === n.id ? "#eef3fb" : "transparent",
                  color: tab === n.id ? THEME.primary : THEME.text,
                  border: `1px solid ${tab === n.id ? "#dbe7fb" : "transparent"}`,
                  borderRadius: THEME.radiusSm,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: 6,
                  textAlign: "left",
                }}
              >
                {n.l}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, padding: isMob ? 12 : 24, paddingBottom: isMob ? 80 : 24 }}>
          {tab === "inventario" && !unidadeAtiva && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: THEME.text }}>Selecionar Unidade</h2>
                <button
                  onClick={() => {
                    setUploadStatus("");
                    setModal("upload");
                  }}
                  style={{ ...bp, fontSize: 12 }}
                >
                  Importar XLSX
                </button>
              </div>
              <TInput initial="" onVal={(v) => setUnidadeSearch(v)} placeholder="Buscar unidade..." style={{ ...inp, marginBottom: 12 }} />
              {unidades.length === 0 ? (
                <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                  <p style={{ margin: 0, fontSize: 13, color: THEME.muted, fontWeight: 700 }}>Nenhuma unidade carregada</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: THEME.muted }}>Importe um arquivo XLSX com os dados patrimoniais.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
                  {unidades.filter((u) => !unidadeSearch || u.nome.toLowerCase().includes(unidadeSearch.toLowerCase())).map((u) => {
                    const invCount = u.itens.filter((i) => foundSet.has(i.id)).length;
                    return (
                      <button
                        key={u.id}
                        onClick={async () => {
                          await saveAtiva(u);
                          setPage(1);
                          showT("Unidade selecionada!");
                        }}
                        style={{ ...cd, border: "1.5px solid #e2e8f0", cursor: "pointer", textAlign: "left" }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{u.nome}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{u.itens.length} itens · {invCount} inventariados</p>
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
                  <button
                    onClick={() => {
                      form.current = { manEstado: "Bom" };
                      setFt((t) => t + 1);
                      setModal("manual");
                    }}
                    style={{ ...bp, fontSize: 11, padding: "6px 12px", background: THEME.success }}
                  >
                    + Manual
                  </button>
                  {totalFound > 0 && (
                    <button onClick={() => setModal("finalizar")} style={{ ...bp, fontSize: 11, padding: "6px 12px", background: THEME.danger }}>
                      Finalizar
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await saveAtiva(null);
                    }}
                    style={{ ...bs, fontSize: 11, padding: "6px 12px" }}
                  >
                    Trocar
                  </button>
                </div>
              </div>

              <div style={{ ...cd, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Progresso</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: THEME.primary }}>{totalFound}/{totalBens}</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: THEME.border }}>
                  <div style={{ height: "100%", background: progresso === 100 ? THEME.success : THEME.primary, borderRadius: 4, width: `${progresso}%` }} />
                </div>
              </div>

              <TInput initial="" onVal={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar nº, espécie, descrição..." style={{ ...inp, marginBottom: 8 }} />

              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(380px, 1fr))", gap: 10 }}>
                {paged.map((item) => {
                  const f = foundMap[item.id];
                  const isF = !!f;
                  const phArr = photos[item.id];
                  const ph = Array.isArray(phArr) ? phArr[0] : phArr;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        form.current = { detItem: item, detEstado: f?.estado || "Bom", detSituacao: f?.situacao || "Em uso", detLocal: f?.localId || "", detObs: f?.obs || "", detMarca: f?.marca || item.marca || "", detOrigem: f?.origem || "Próprio" };
                        setFt((t) => t + 1);
                        setModal("detalhe");
                      }}
                      style={{ ...cd, cursor: "pointer", borderColor: isF ? "#b7e4c7" : THEME.border, display: "flex", gap: 12 }}
                    >
                      {ph ? (
                        <img src={ph} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: isF ? "#ecfdf3" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, letterSpacing: 0.6, flexShrink: 0, color: isF ? THEME.success : THEME.muted }}>
                          {isF ? "OK" : "FOTO"}
                        </div>
                      )}
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

          {tab === "itens" && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: THEME.text }}>Itens</h2>
              {(() => {
                const categorias = ["Todas", ...Array.from(new Set(allItens.map((i) => i.especie || "OUTROS"))).sort()];
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "2fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <TInput initial="" onVal={(v) => { setItensSearch(v); setItensPage(1); }} placeholder="Buscar item..." style={inp} />
                      <select value={itensFilterCat} onChange={(e) => { setItensFilterCat(e.target.value); setItensPage(1); }} style={inp}>
                        {categorias.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <select value={itensFilterEstado} onChange={(e) => { setItensFilterEstado(e.target.value); setItensPage(1); }} style={inp}>
                        <option>Todos</option>
                        {ESTADOS.map((e) => (
                          <option key={e}>{e}</option>
                        ))}
                      </select>
                      <select value={itensFilterOrigem} onChange={(e) => { setItensFilterOrigem(e.target.value); setItensPage(1); }} style={inp}>
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
                          (!s ||
                            item.id.toLowerCase().includes(s) ||
                            (item.especie || "").toLowerCase().includes(s) ||
                            (item.descricao || "").toLowerCase().includes(s) ||
                            (item.marca || "").toLowerCase().includes(s)) &&
                          (itensFilterCat === "Todas" || (item.especie || "OUTROS") === itensFilterCat) &&
                          (itensFilterEstado === "Todos" || f?.estado === itensFilterEstado) &&
                          (itensFilterOrigem === "Todas" || (f?.origem || "Próprio") === itensFilterOrigem)
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
                              const phArr = photos[item.id];
                              const ph = Array.isArray(phArr) ? phArr[0] : phArr;
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    form.current = { detItem: item, detEstado: f?.estado || "Bom", detSituacao: f?.situacao || "Em uso", detLocal: f?.localId || "", detObs: f?.obs || "", detMarca: f?.marca || item.marca || "", detOrigem: f?.origem || "Próprio" };
                                    setFt((t) => t + 1);
                                    setModal("detalhe");
                                  }}
                                  style={{ ...cd, cursor: "pointer", padding: 0, overflow: "hidden" }}
                                >
                                  {ph ? (
                                    <img src={ph} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                                  ) : (
                                    <div style={{ width: "100%", height: 140, background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, color: THEME.muted }}>
                                      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.8 }}>SEM IMAGEM</span>
                                    </div>
                                  )}
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
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: THEME.text }}>Notas Fiscais</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
                {Object.values(nfMap)
                  .sort((a, b) => b.total - a.total)
                  .map((n) => (
                    <div key={n.nf} style={cd}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>NF {n.nf}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: THEME.muted }}>{n.fornecedor}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: THEME.success }}>R$ {n.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 8 }}>
                        {n.itens.slice(0, 5).map((i) => (
                          <p key={i.id} style={{ margin: "2px 0", fontSize: 11, color: "#374151" }}>
                            {i.id} — {i.descricao || i.especie}
                          </p>
                        ))}
                        {n.itens.length > 5 && <p style={{ margin: "6px 0 0", fontSize: 11, color: THEME.muted }}>+{n.itens.length - 5} mais</p>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tab === "tombos" && (
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: THEME.text }}>Tombos</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={() => setTombosTab("ne")} style={{ ...(tombosTab === "ne" ? bp : bs), fontSize: 12 }}>
                  Não encontrados ({tombosNE.length})
                </button>
                <button onClick={() => setTombosTab("dup")} style={{ ...(tombosTab === "dup" ? bp : bs), fontSize: 12 }}>
                  Duplicados ({tombosDup.length})
                </button>
              </div>
              {tombosTab === "ne" &&
                (tombosNE.length === 0 ? (
                  <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                    <p style={{ margin: 0, fontSize: 13, color: THEME.muted, fontWeight: 800 }}>Nenhum registro</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
                    {tombosNE.map((i, idx) => (
                      <div key={idx} style={{ ...cd, borderColor: "#f3b8b8" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: THEME.danger }}>{i.descricao || i.especie}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: THEME.muted }}>Nº {i.id} · {i.unidade}</p>
                      </div>
                    ))}
                  </div>
                ))}
              {tombosTab === "dup" &&
                (tombosDup.length === 0 ? (
                  <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                    <p style={{ margin: 0, fontSize: 13, color: THEME.muted, fontWeight: 800 }}>Nenhum registro</p>
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: THEME.muted }}>Aparece quando há duplicidade ao importar relatórios.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
                    {tombosDup.map((i, idx) => (
                      <div key={idx} style={{ ...cd, borderColor: "#c7d2fe" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: THEME.primary }}>{i.descricao || i.especie}</p>
                        <p style={{ margin: "6px 0 0", fontSize: 11, color: THEME.danger }}>Pertence: {i.unidadeOrigem}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: THEME.success }}>Encontrado: {i.unidadeEncontrada}</p>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}

          {tab === "dash" && (
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: THEME.text }}>Painel</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {[{ l: "Total", v: totalBens, c: THEME.primary }, { l: "Encontrados", v: totalFound, c: THEME.success }, { l: "Pendentes", v: totalBens - totalFound, c: THEME.danger }, { l: "Progresso", v: `${progresso}%`, c: THEME.primary }].map((s) => (
                  <div key={s.l} style={cd}>
                    <p style={{ margin: 0, fontSize: isMob ? 20 : 28, fontWeight: 700, color: s.c }}>{s.v}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: THEME.muted }}>{s.l}</p>
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
                        <div style={{ flex: 1, height: 5, borderRadius: 4, background: THEME.border }}>
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
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: THEME.text }}>Locais</h2>
                <button
                  onClick={() => {
                    form.current = {};
                    setModal("addLocal");
                  }}
                  style={bp}
                >
                  + Novo
                </button>
              </div>
              {locais.length === 0 ? (
                <div style={{ ...cd, textAlign: "center", padding: 40 }}>
                  <p style={{ margin: 0, fontSize: 13, color: THEME.muted, fontWeight: 700 }}>Nenhum local cadastrado</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: THEME.muted }}>Crie locais para registrar a localização dos bens.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {locais.map((l) => {
                    const c = found.filter((f) => f.localId === l.id).length;
                    return (
                      <div key={l.id} style={{ ...cd, display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: THEME.text }}>{l.nome}</p>
                          {l.desc && <p style={{ margin: "2px 0 0", fontSize: 12, color: THEME.muted }}>{l.desc}</p>}
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: THEME.muted }}>{c} item(s)</p>
                        </div>
                        <button
                          onClick={() => {
                            if (c > 0) {
                              showT("Remova itens antes");
                              return;
                            }
                            saveLocais(locais.filter((x) => x.id !== l.id));
                          }}
                          style={{ border: `1px solid ${THEME.border}`, background: THEME.surface, color: THEME.danger, borderRadius: THEME.radiusSm, padding: "7px 10px", cursor: "pointer", fontWeight: 800, fontSize: 12 }}
                        >
                          Excluir
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
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: THEME.surface, borderTop: `1px solid ${THEME.border}`, display: "flex", zIndex: 200 }}>
          {navs.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, padding: "10px 6px", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ height: 3, width: 28, borderRadius: 2, background: tab === n.id ? THEME.primary : "transparent" }} />
              <span style={{ fontSize: 10, fontWeight: tab === n.id ? 800 : 600, color: tab === n.id ? THEME.primary : THEME.muted }}>{n.l}</span>
            </button>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />

      {modal === "camera" && (
        <CameraModal
          existingPhotos={cameraTarget === "manual" ? form.current.manPhotos || [] : Array.isArray(photos[cameraTarget]) ? photos[cameraTarget] : photos[cameraTarget] ? [photos[cameraTarget]] : []}
          onCapture={onCameraCapture}
          onClose={() => {
            setCameraTarget(null);
            setModal(form.current.detItem ? "detalhe" : null);
          }}
        />
      )}

      {modal === "upload" && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: THEME.text }}>Importar Relatório</h2>
          <button onClick={() => fileRef.current?.click()} style={{ width: "100%", border: `2px dashed ${THEME.border}`, background: THEME.bg, borderRadius: THEME.radius, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, color: THEME.muted }}>ARQUIVO XLSX</span>
            <span style={{ fontSize: 13, color: THEME.text, fontWeight: 700 }}>Selecionar arquivo</span>
            <span style={{ fontSize: 11, color: THEME.muted }}>O sistema identifica unidades automaticamente.</span>
          </button>
          {uploadStatus && <p style={{ fontSize: 13, color: THEME.warningText, margin: "12px 0", fontWeight: 700 }}>{uploadStatus}</p>}
          <button onClick={() => setModal(null)} style={{ ...bs, width: "100%", marginTop: 16 }}>
            Cancelar
          </button>
        </Overlay>
      )}

      {modal === "detalhe" && form.current.detItem && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>{form.current.detItem.descricao || form.current.detItem.especie || "—"}</h2>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>Nº {form.current.detItem.id} · {form.current.detItem.data} · R$ {(form.current.detItem.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>Fornecedor: {form.current.detItem.fornecedor || "—"} · Marca: {form.current.detItem.marca || "—"} · NF: {form.current.detItem.nf || "—"} · Empenho: {form.current.detItem.empenho || "—"}</p>
          {(() => {
            const phArr = photos[form.current.detItem.id];
            const photoList = Array.isArray(phArr) ? phArr : phArr ? [phArr] : [];
            return (
              <div style={{ marginBottom: 14 }}>
                {photoList.length > 0 ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                      {photoList.map((ph, i) => (
                        <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                          <img src={ph} alt="" style={{ width: photoList.length === 1 ? "100%" : 200, height: photoList.length === 1 ? 180 : 140, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }} />
                          <button onClick={() => { const newArr = photoList.filter((_, j) => j !== i); if (newArr.length) savePhotos(form.current.detItem.id, newArr); else delPhotos(form.current.detItem.id); setFt((t) => t + 1); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(220,38,38,.85)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => openCamera(form.current.detItem.id)} style={{ width: "100%", border: `1px dashed ${THEME.border}`, background: THEME.bg, borderRadius: THEME.radiusSm, padding: "10px", cursor: "pointer", fontSize: 13, color: THEME.primary, fontWeight: 800, marginTop: 6 }}>
                      Adicionar fotos ({photoList.length} salva{photoList.length > 1 ? "s" : ""})
                    </button>
                  </div>
                ) : (
                  <button onClick={() => openCamera(form.current.detItem.id)} style={{ width: "100%", border: `2px dashed ${THEME.border}`, background: THEME.bg, borderRadius: THEME.radius, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: THEME.text, fontWeight: 800 }}>Adicionar fotos</span>
                    <span style={{ fontSize: 11, color: THEME.muted }}>Item, plaqueta, estado de conservação</span>
                  </button>
                )}
              </div>
            );
          })()}
          <Lbl>Local</Lbl>
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
              <button key={o} onClick={() => { form.current.detOrigem = o; setFt((t) => t + 1); }} style={{ flex: 1, padding: "10px", borderRadius: THEME.radiusSm, fontSize: 12, fontWeight: 800, cursor: "pointer", border: `1px solid ${(form.current.detOrigem || "Próprio") === o ? "#b7cef5" : THEME.border}`, background: (form.current.detOrigem || "Próprio") === o ? "#eef3fb" : THEME.surface, color: (form.current.detOrigem || "Próprio") === o ? THEME.primary : THEME.muted }}>
                {o}
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
                  await saveFound(found.filter((f) => f.patrimonioId !== form.current.detItem.id));
                  setModal(null);
                  showT("Removido");
                }}
                style={{ ...bs, flex: 1, color: THEME.danger, fontWeight: 800 }}
              >
                Excluir
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
          <TArea
            key="manDesc"
            initial={gf("manDesc")}
            onVal={(v) => {
              uf("manDesc", v);
              const lower = v.toLowerCase();
              const categorias = [
                { keys: ["ar condicionado", "split", "ar-condicionado"], esp: "AR CONDICIONADO" },
                { keys: ["cadeira", "poltrona", "banqueta"], esp: "CADEIRA" },
                { keys: ["mesa", "escrivaninha", "bancada"], esp: "MESA" },
                { keys: ["armário", "armario", "guarda-roupa"], esp: "ARMÁRIO" },
                { keys: ["estante", "prateleira"], esp: "ESTANTE" },
                { keys: ["bebedouro", "purificador"], esp: "BEBEDOURO" },
                { keys: ["computador", "desktop", "cpu", "pc"], esp: "COMPUTADOR" },
                { keys: ["notebook", "laptop"], esp: "NOTEBOOK" },
                { keys: ["impressora", "multifuncional"], esp: "IMPRESSORA" },
                { keys: ["monitor", "tela"], esp: "MONITOR" },
                { keys: ["telefone", "ramal"], esp: "TELEFONE" },
                { keys: ["geladeira", "refrigerador", "frigobar"], esp: "GELADEIRA" },
                { keys: ["microondas", "micro-ondas"], esp: "MICRO-ONDAS" },
                { keys: ["fogão", "fogao", "cooktop"], esp: "FOGÃO" },
                { keys: ["ventilador", "circulador"], esp: "VENTILADOR" },
                { keys: ["arquivo", "gaveteiro"], esp: "ARQUIVO" },
                { keys: ["sofá", "sofa"], esp: "SOFÁ" },
                { keys: ["longarina", "banco"], esp: "LONGARINA" },
                { keys: ["quadro", "mural"], esp: "QUADRO" },
                { keys: ["televisor", "tv", "televisão"], esp: "TELEVISOR" },
                { keys: ["nobreak", "no-break", "estabilizador"], esp: "NOBREAK" },
                { keys: ["relógio", "relogio", "ponto"], esp: "RELÓGIO DE PONTO" },
              ];
              const f = categorias.find((c) => c.keys.some((k) => lower.includes(k)));
              if (f) uf("manEspecie", f.esp);
            }}
            rows={3}
            placeholder="Descreva o item... (a espécie é detectada automaticamente)"
            style={{ ...inp, resize: "none" }}
          />
          <Lbl>Espécie (auto-detectada)</Lbl>
          <TInput key={"manEsp_" + ft} initial={gf("manEspecie")} onVal={(v) => uf("manEspecie", v)} placeholder="Detectada ou digite..." style={{ ...inp, background: "#f8fafc" }} />
          <Lbl>Marca</Lbl>
          <TInput key="manMarca" initial={gf("manMarca")} onVal={(v) => uf("manMarca", v)} placeholder="Ex: Tramontina..." style={inp} />
          <Lbl>Fornecedor</Lbl>
          <TInput key="manForn" initial={gf("manFornecedor")} onVal={(v) => uf("manFornecedor", v)} placeholder="Fornecedor..." style={inp} />
          <Lbl>Valor</Lbl>
          <TInput key="manVal" initial={gf("manValor")} onVal={(v) => uf("manValor", v)} type="number" placeholder="0.00" style={inp} />
          <Lbl>Origem</Lbl>
          <div style={{ display: "flex", gap: 8 }}>
            {["Próprio", "Doação", "Permuta"].map((o) => (
              <button key={o} onClick={() => { form.current.manOrigem = o; setFt((t) => t + 1); }} style={{ flex: 1, padding: "10px", borderRadius: THEME.radiusSm, fontSize: 12, fontWeight: 800, cursor: "pointer", border: `1px solid ${(form.current.manOrigem || "Próprio") === o ? "#b7cef5" : THEME.border}`, background: (form.current.manOrigem || "Próprio") === o ? "#eef3fb" : THEME.surface, color: (form.current.manOrigem || "Próprio") === o ? THEME.primary : THEME.muted }}>
                {o}
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
              <button onClick={() => { setCameraTarget("manual"); setModal("camera"); }} style={{ width: "100%", border: `1px dashed ${THEME.border}`, background: THEME.bg, borderRadius: THEME.radiusSm, padding: 10, cursor: "pointer", fontSize: 12, color: THEME.primary, fontWeight: 800 }}>
                Adicionar fotos
              </button>
            </div>
          ) : (
            <button onClick={() => { setCameraTarget("manual"); setModal("camera"); }} style={{ width: "100%", border: `2px dashed ${THEME.border}`, background: THEME.bg, borderRadius: THEME.radius, padding: 18, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: THEME.text, fontWeight: 800 }}>Adicionar fotos</span>
              <span style={{ fontSize: 11, color: THEME.muted }}>Abrir câmera</span>
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
            <p style={{ margin: 0, fontSize: 12, color: THEME.muted, fontWeight: 900, letterSpacing: 0.8 }}>CONFIRMAÇÃO</p>
            <h2 style={{ margin: "10px 0 8px", fontSize: 20, fontWeight: 900, color: THEME.text }}>Finalizar inventário</h2>
            <p style={{ color: THEME.muted, margin: "0 0 16px", fontSize: 12, fontWeight: 700 }}>{unidadeAtiva?.nome}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "#ecfdf3", borderRadius: THEME.radius, padding: 12, border: "1px solid #abefc6" }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: THEME.success }}>{totalFound}</p>
                <p style={{ margin: 0, fontSize: 12, color: THEME.muted, fontWeight: 700 }}>Encontrados</p>
              </div>
              <div style={{ background: "#fff1f3", borderRadius: THEME.radius, padding: 12, border: "1px solid #fda4af" }}>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: THEME.danger }}>{totalBens - totalFound}</p>
                <p style={{ margin: 0, fontSize: 12, color: THEME.muted, fontWeight: 700 }}>Não encontrados</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={finalizarInv} style={{ ...bp, flex: 1, background: THEME.danger }}>
                Finalizar
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {toast && <div style={{ position: "fixed", bottom: isMob ? 82 : 24, left: "50%", transform: "translateX(-50%)", background: THEME.text, color: "#fff", padding: "10px 16px", borderRadius: THEME.radius, fontSize: 13, fontWeight: 700, zIndex: 400, boxShadow: THEME.shadow }}>{toast}</div>}
    </div>
  );
}
