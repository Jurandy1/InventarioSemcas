import React, { useEffect, useRef, useState } from "react";
import { AuthPageLayout } from "../components/AuthPageLayout.jsx";
import { getAppStyles } from "../constants/theme.js";
import {
  fsGetDocPublic,
  fsSetStrict,
  isFirebaseConfigured,
  fbRegister,
  setFirebaseSession,
  marcarConviteCoordUsado,
  verificarCadastroDuplicado,
  registrarCadastroIndice,
} from "../services/firebase.js";
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
  const [duplicataAviso, setDuplicataAviso] = useState("");
  const [checandoDuplicata, setChecandoDuplicata] = useState(false);
  const debounceRef = useRef(null);

  const firebaseOk = isFirebaseConfigured();
  const { inp } = getAppStyles(false);

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

  useEffect(() => {
    if (status !== "formulario") return;
    const email = formData.email.trim();
    const matricula = formData.matricula.trim();
    const nome = formData.nome.trim();
    if (!email && !matricula && !nome) {
      setDuplicataAviso("");
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setChecandoDuplicata(true);
      try {
        const dup = await verificarCadastroDuplicado({
          email,
          matricula,
          nome,
          papel: "coordenador",
        });
        setDuplicataAviso(dup.blocked ? dup.message : "");
      } catch {
        setDuplicataAviso("");
      } finally {
        setChecandoDuplicata(false);
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [status, formData.email, formData.matricula, formData.nome]);

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
      const dupPre = await verificarCadastroDuplicado({
        email: formData.email.trim(),
        matricula: formData.matricula.trim(),
        nome: formData.nome.trim(),
        papel: "coordenador",
      });
      if (dupPre.blocked) {
        setError(dupPre.message);
        return;
      }

      const user = await fbRegister(formData.email.trim(), formData.senha);
      setFirebaseSession({ token: user.token, uid: user.uid });

      const dupPos = await verificarCadastroDuplicado({
        email: formData.email.trim(),
        matricula: formData.matricula.trim(),
        nome: formData.nome.trim(),
        papel: "coordenador",
        excludeUid: user.uid,
      });
      if (dupPos.blocked) {
        setError(
          dupPos.message + " A conta foi criada, mas o cadastro não foi concluído. Contate o administrador."
        );
        return;
      }

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

      try {
        await registrarCadastroIndice({
          uid: user.uid,
          email: formData.email.trim(),
          matricula: formData.matricula.trim(),
          nome: formData.nome.trim(),
          papel: "coordenador",
          status: "pendente_aprovacao",
        });
      } catch (idxErr) {
        console.warn("Índice anti-duplicação não gravado:", idxErr);
      }

      try {
        await marcarConviteCoordUsado(token, convite);
      } catch (markErr) {
        console.warn("Convite não marcado como usado:", markErr);
      }

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
      <div className="gov-loading">
        <div className="gov-spinner" aria-hidden="true" />
        <p style={{ color: "var(--gov-text-muted)", fontSize: 13 }}>Validando convite...</p>
      </div>
    );
  }

  if (status === "sucesso") {
    return (
      <AuthPageLayout title="Registro concluído!" subtitle={`Bem-vinda, ${formData.nome}!`} footer="Secretaria Municipal — SEMCAS">
        <div className="gov-alert gov-alert--info" style={{ marginBottom: 20 }}>
          Sua solicitação foi enviada para aprovação. O administrador analisará seus dados e você receberá confirmação por e-mail.
        </div>
        <button
          type="button"
          className="gov-btn gov-btn--primary"
          style={{ width: "100%" }}
          onClick={() => {
            try { window.location.href = `${import.meta.env.BASE_URL}#/coord/`; } catch {}
          }}
        >
          Ir para o login da coordenadora
        </button>
      </AuthPageLayout>
    );
  }

  if (status === "erro") {
    return (
      <AuthPageLayout title="Acesso negado" subtitle="Não foi possível validar o convite" footer="Solicite um novo link ao administrador">
        <div className="gov-alert gov-alert--danger" style={{ marginBottom: 16 }}>{error}</div>
        <button type="button" className="gov-btn gov-btn--secondary" style={{ width: "100%" }} onClick={() => { try { window.history.back(); } catch {} }}>
          Voltar
        </button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      badge="Coordenadoria"
      title="Registro de coordenadora"
      subtitle={convite?.unidadeNome ? `Unidade: ${convite.unidadeNome}` : "Inventário SEMCAS"}
      footer="Após o registro, aguarde a aprovação do administrador"
    >
      {duplicataAviso && (
        <div className="gov-alert gov-alert--warning" style={{ marginBottom: 16 }}>
          {duplicataAviso}
        </div>
      )}
      {checandoDuplicata && !duplicataAviso && (
        <p style={{ fontSize: 12, color: "var(--gov-text-muted)", marginBottom: 12 }}>Verificando duplicidade...</p>
      )}

      {error && <div className="gov-alert gov-alert--danger" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Nome completo *</label>
            <TInput
              initial={formData.nome}
              onVal={(v) => setFormData((prev) => ({ ...prev, nome: v }))}
              placeholder="Ex: Maria Silva"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Matrícula *</label>
            <TInput
              initial={formData.matricula}
              onVal={(v) => setFormData((prev) => ({ ...prev, matricula: v }))}
              placeholder="Ex: 123456"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Email *</label>
            <TInput
              initial={formData.email}
              onVal={(v) => setFormData((prev) => ({ ...prev, email: v }))}
              type="email"
              placeholder="seu@email.com"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Senha *</label>
            <TInput
              initial={formData.senha}
              onVal={(v) => setFormData((prev) => ({ ...prev, senha: v }))}
              type="password"
              placeholder="Mínimo 6 caracteres"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Confirme a senha *</label>
            <TInput
              initial={formData.confirmaSenha}
              onVal={(v) => setFormData((prev) => ({ ...prev, confirmaSenha: v }))}
              type="password"
              placeholder="Repita a senha"
              style={inp}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || Boolean(duplicataAviso)}
            className="gov-btn gov-btn--primary"
            style={{ width: "100%", marginTop: 8, opacity: submitting ? 0.8 : 1 }}
          >
            {submitting ? "Registrando..." : "Registrar"}
          </button>
        </form>
    </AuthPageLayout>
  );
}
