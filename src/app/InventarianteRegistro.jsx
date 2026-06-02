import React, { useEffect, useState } from "react";
import { fsGetAll, fsSet, isFirebaseConfigured, fbRegister, setFirebaseSession } from "../services/firebase.js";
import { TInput } from "../components/FormFields.jsx";

function getTokenFromLocation() {
  const path = String(window.location.pathname || "");
  const hash = String(window.location.hash || "");
  const m1 = path.match(/\/invregistro\/([^/]+)/);
  const m2 = hash.match(/#\/invregistro\/([^/?]+)/);
  return (m1?.[1] || m2?.[1] || "").trim() || null;
}

export function InventarianteRegistro() {
  const [status, setStatus] = useState("loading"); // loading | formulario | sucesso | erro
  const [token, setToken] = useState(null);
  const [convite, setConvite] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmaSenha: "",
    matricula: "",
    cargo: "",
  });

  const firebaseOk = isFirebaseConfigured();

  const inp = {
    width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9,
    padding: "10px 13px", fontSize: 14, fontFamily: "inherit",
    boxSizing: "border-box", outline: "none",
  };

  const validateToken = async (tok) => {
    setError("");
    try {
      const convites = await fsGetAll("convites_inventariantes");
      const found = convites.find((c) => c?._id === tok || c?.token === tok);

      if (!found) {
        setStatus("erro");
        setError("Link inválido ou expirado. Solicite um novo convite ao administrador.");
        return;
      }

      if (new Date() > new Date(found.dataExpiracao)) {
        setStatus("erro");
        setError(`Este convite expirou em ${new Date(found.dataExpiracao).toLocaleDateString("pt-BR")}. Solicite um novo.`);
        return;
      }

      if (found.status === "usado") {
        setStatus("erro");
        setError("Este convite já foi utilizado. Solicite um novo link ao administrador.");
        return;
      }

      if (found.status !== "ativo") {
        setStatus("erro");
        setError("Este convite não está ativo.");
        return;
      }

      setToken(tok);
      setConvite(found);
      setStatus("formulario");
    } catch (err) {
      console.error(err);
      setStatus("erro");
      setError("Erro ao validar o link. Verifique sua conexão e tente novamente.");
    }
  };

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setStatus("erro");
        setError("Sistema não configurado. Contate o administrador.");
        return;
      }
      const tok = getTokenFromLocation();
      if (!tok) {
        setStatus("erro");
        setError("Link inválido. Você precisa de um convite para se cadastrar.");
        return;
      }
      await validateToken(tok);
    }
    boot();
  }, [firebaseOk]);

  const handleSubmit = async () => {
    setError("");

    if (!formData.nome.trim()) { setError("Nome completo é obrigatório"); return; }
    if (!formData.email.trim()) { setError("E-mail é obrigatório"); return; }
    if (!formData.matricula.trim()) { setError("Matrícula é obrigatória"); return; }
    if (!formData.senha || formData.senha.length < 6) { setError("Senha deve ter no mínimo 6 caracteres"); return; }
    if (formData.senha !== formData.confirmaSenha) { setError("As senhas não conferem"); return; }

    setSubmitting(true);
    try {
      // Create Firebase Auth account
      const user = await fbRegister(formData.email.trim(), formData.senha);
      setFirebaseSession({ token: user.token, uid: user.uid });

      // Save to inventariantes collection (pending approval)
      const invData = {
        uid: user.uid,
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        matricula: formData.matricula.trim(),
        cargo: formData.cargo.trim(),
        status: "pendente_aprovacao",
        dataCriacao: new Date().toISOString(),
        conviteToken: token,
        criadoEm: new Date().toISOString(),
      };
      await fsSet("inventariantes", user.uid, invData);

      // Mark invite as used
      await fsSet("convites_inventariantes", token, { ...convite, status: "usado", dataUso: new Date().toISOString(), usadoPor: user.uid });

      setStatus("sucesso");
    } catch (err) {
      console.error(err);
      if (err.message === "EMAIL_EXISTS" || err.message?.includes("EMAIL_EXISTS")) {
        setError("Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.");
      } else {
        setError(err.message || "Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f1f5f9", gap: 16 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#1e3a8a", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 13 }}>Validando convite...</p>
      </div>
    );
  }

  // ── Erro ──
  if (status === "erro") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e3a8a,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700 }}>Link inválido</h1>
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#991b1b", fontWeight: 600, lineHeight: 1.5 }}>{error}</p>
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>
            Contate o administrador do sistema para receber um novo link de convite.
          </p>
        </div>
      </div>
    );
  }

  // ── Sucesso ──
  if (status === "sucesso") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e3a8a,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Cadastro realizado!</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 20px" }}>
            Bem-vindo(a), <strong>{formData.nome}</strong>!
          </p>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 16, marginBottom: 24, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e3a8a", marginBottom: 6 }}>Próximo passo</p>
            <p style={{ margin: 0, fontSize: 13, color: "#1e40af", lineHeight: 1.5 }}>
              Seu cadastro foi enviado para aprovação. O administrador analisará suas informações
              e liberará o acesso em breve. Você será notificado quando puder fazer login.
            </p>
          </div>
          <button
            onClick={() => {
              try { window.location.href = import.meta.env.BASE_URL || "/"; } catch {}
            }}
            style={{ width: "100%", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 9, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  // ── Formulário ──
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e3a8a,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 460 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Cadastro de Inventariante</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Inventário SEMCAS</p>
        </div>

        {/* Invite info banner */}
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#065f46", fontWeight: 600 }}>
            Convite válido até {new Date(convite?.dataExpiracao).toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#991b1b" }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
              Nome completo <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <TInput
              initial={formData.nome}
              onVal={(v) => setFormData((p) => ({ ...p, nome: v }))}
              placeholder="Ex: João Silva"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
              Matrícula <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <TInput
              initial={formData.matricula}
              onVal={(v) => setFormData((p) => ({ ...p, matricula: v }))}
              placeholder="Ex: 123456"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
              Cargo / Função
            </label>
            <TInput
              initial={formData.cargo}
              onVal={(v) => setFormData((p) => ({ ...p, cargo: v }))}
              placeholder="Ex: Assistente Administrativo"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
              E-mail <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <TInput
              initial={formData.email}
              onVal={(v) => setFormData((p) => ({ ...p, email: v }))}
              type="email"
              placeholder="seu@email.com"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
              Senha <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <TInput
              initial={formData.senha}
              onVal={(v) => setFormData((p) => ({ ...p, senha: v }))}
              type="password"
              placeholder="Mínimo 6 caracteres"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
              Confirmar senha <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <TInput
              initial={formData.confirmaSenha}
              onVal={(v) => setFormData((p) => ({ ...p, confirmaSenha: v }))}
              type="password"
              placeholder="Repita a senha"
              style={inp}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: "100%", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 9, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", marginTop: 4, opacity: submitting ? 0.8 : 1 }}
          >
            {submitting ? "Cadastrando..." : "Criar conta"}
          </button>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.4 }}>
          Após o cadastro, você precisará aguardar a aprovação do administrador antes de acessar o sistema.
        </p>
      </div>
    </div>
  );
}
