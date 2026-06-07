import React, { useEffect, useState } from "react";
import { fsGetDocPublic, fsSetStrict, isFirebaseConfigured, fbRegister, setFirebaseSession } from "../services/firebase.js";
import { TInput } from "../components/FormFields.jsx";

function getTokenFromLocation() {
  const path = String(window.location.pathname || "");
  const hash = String(window.location.hash || "");
  const m1 = path.match(/\/coordregistro\/([^/]+)/);
  const m2 = hash.match(/#\/coordregistro\/([^/?]+)/);
  return (m1?.[1] || m2?.[1] || "").trim() || null;
}

export function CoordinadorRegistro() {
  const [status, setStatus] = useState("loading");
  const [token, setToken] = useState(null);
  const [convite, setConvite] = useState(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmaSenha: "",
    matricula: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const firebaseOk = isFirebaseConfigured();

  const validateToken = async (tok) => {
    try {
      setError("");
      const found = await fsGetDocPublic("convites", tok);

      if (!found) {
        setStatus("erro");
        setError("Link inválido ou expirado");
        return;
      }

      const dataExpiracao = new Date(found.dataExpiracao);
      if (new Date() > dataExpiracao) {
        setStatus("erro");
        setError("Este link de convite expirou em " + dataExpiracao.toLocaleDateString("pt-BR"));
        return;
      }

      if (found.status === "usado") {
        setStatus("erro");
        setError("Este convite já foi utilizado");
        return;
      }

      if (found.status !== "ativo") {
        setStatus("erro");
        setError("Este convite não está ativo");
        return;
      }

      setToken(tok);
      setConvite(found);
      setFormData((prev) => ({
        ...prev,
        matricula: found.matricula || "",
        nome: found.nomeSugerido || prev.nome || "",
      }));
      setStatus("formulario");
    } catch (err) {
      console.error("Erro ao validar token:", err);
      setStatus("erro");
      setError(err?.message || "Erro ao validar acesso");
    }
  };

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setStatus("erro");
        setError("Firebase não configurado");
        return;
      }

      const tok = getTokenFromLocation();
      if (tok) {
        await validateToken(tok);
      } else {
        setStatus("erro");
        setError("Token não fornecido");
      }
    }
    boot();
  }, [firebaseOk]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.nome.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email é obrigatório");
      return;
    }
    if (!formData.senha || formData.senha.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (formData.senha !== formData.confirmaSenha) {
      setError("Senhas não conferem");
      return;
    }
    if (!formData.matricula.trim()) {
      setError("Matrícula é obrigatória");
      return;
    }

    setSubmitting(true);

    try {
      const user = await fbRegister(formData.email.trim(), formData.senha);
      setFirebaseSession({ token: user.token, uid: user.uid });

      const coordData = {
        uid: user.uid,
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        matricula: formData.matricula.trim(),
        unidadeId: convite.unidadeId,
        unidadeNome: convite.unidadeNome,
        unidadeIds: Array.isArray(convite.unidadeIds) && convite.unidadeIds.length
          ? convite.unidadeIds
          : convite.unidadeId
            ? [convite.unidadeId]
            : [],
        unidadeNomes: Array.isArray(convite.unidadeNomes) && convite.unidadeNomes.length
          ? convite.unidadeNomes
          : convite.unidadeNome
            ? [convite.unidadeNome]
            : [],
        status: "pendente_aprovacao",
        dataCriacao: new Date().toISOString(),
        conviteToken: token,
        criadoEm: new Date().toISOString(),
      };

      await fsSetStrict("coordenadores", user.uid, coordData);

      const conviteAtualizado = { ...convite, status: "usado", dataUso: new Date().toISOString() };
      await fsSetStrict("convites", token, conviteAtualizado);

      setStatus("sucesso");
    } catch (err) {
      console.error("Erro ao registrar:", err);
      setError(err.message || "Erro ao registrar coordenadora");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f1f5f9", gap: 16 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#6b21a8", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 13 }}>Validando convite...</p>
      </div>
    );
  }

  if (status === "sucesso") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #6b21a8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700 }}>Registro concluído!</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
            Bem-vinda, <strong>{formData.nome}</strong>!
          </p>
          <div style={{ background: "#f3e8ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#6b21a8", fontWeight: 600 }}>
              Sua solicitação foi enviada para aprovação. O administrador analisará seus dados e você receberá um email de confirmação.
            </p>
          </div>
          <button
            onClick={() => {
              try {
                window.location.href = `${import.meta.env.BASE_URL}#/coord/`;
              } catch {}
            }}
            style={{ width: "100%", background: "#6b21a8", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (status === "erro") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #6b21a8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700 }}>Acesso negado</h1>
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#991b1b", fontWeight: 600, lineHeight: 1.4 }}>{error}</p>
          </div>
          <button
            onClick={() => {
              try {
                window.history.back();
              } catch {}
            }}
            style={{ width: "100%", background: "#6b21a8", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #6b21a8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Registre-se como Coordenadora</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Inventário SEMCAS · {convite?.unidadeNome || ""}</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#991b1b" }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Nome completo *</label>
            <TInput
              initial={formData.nome}
              onVal={(v) => setFormData((prev) => ({ ...prev, nome: v }))}
              placeholder="Ex: Maria Silva"
              style={{
                width: "100%",
                border: "1.5px solid #d1d5db",
                borderRadius: 9,
                padding: "10px 13px",
                fontSize: 14,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Matrícula *</label>
            <TInput
              initial={formData.matricula}
              onVal={(v) => setFormData((prev) => ({ ...prev, matricula: v }))}
              placeholder="Ex: 123456"
              style={{
                width: "100%",
                border: "1.5px solid #d1d5db",
                borderRadius: 9,
                padding: "10px 13px",
                fontSize: 14,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Email *</label>
            <TInput
              initial={formData.email}
              onVal={(v) => setFormData((prev) => ({ ...prev, email: v }))}
              type="email"
              placeholder="seu@email.com"
              style={{
                width: "100%",
                border: "1.5px solid #d1d5db",
                borderRadius: 9,
                padding: "10px 13px",
                fontSize: 14,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Senha *</label>
            <TInput
              initial={formData.senha}
              onVal={(v) => setFormData((prev) => ({ ...prev, senha: v }))}
              type="password"
              placeholder="Mínimo 6 caracteres"
              style={{
                width: "100%",
                border: "1.5px solid #d1d5db",
                borderRadius: 9,
                padding: "10px 13px",
                fontSize: 14,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Confirme a senha *</label>
            <TInput
              initial={formData.confirmaSenha}
              onVal={(v) => setFormData((prev) => ({ ...prev, confirmaSenha: v }))}
              type="password"
              placeholder="Repita a senha"
              style={{
                width: "100%",
                border: "1.5px solid #d1d5db",
                borderRadius: 9,
                padding: "10px 13px",
                fontSize: 14,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              background: "#6b21a8",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "11px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              marginTop: 8,
              opacity: submitting ? 0.8 : 1,
            }}
          >
            {submitting ? "Registrando..." : "Registrar"}
          </button>
        </form>

        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
          Após o registro, você precisará da aprovação do administrador para acessar o sistema.
        </p>
      </div>
    </div>
  );
}
