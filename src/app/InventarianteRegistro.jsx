import React, { useEffect, useRef, useState } from "react";
import { AuthPageLayout } from "../components/AuthPageLayout.jsx";
import { getAppStyles } from "../constants/theme.js";
import {
  fsGetDocPublic,
  fsSetStrict,
  isFirebaseConfigured,
  fbRegister,
  setFirebaseSession,
  marcarConviteInventarianteUsado,
  verificarCadastroDuplicado,
  registrarCadastroIndice,
} from "../services/firebase.js";
import { TInput } from "../components/FormFields.jsx";

function getTokenFromLocation() {
  const path = String(window.location.pathname || "");
  const hash = String(window.location.hash || "");
  const search = String(window.location.search || "");
  const m1 = path.match(/\/invregistro\/([^/]+)/);
  const m2 = hash.match(/#\/invregistro\/([^/?#]+)/);
  const m3 = search.match(/[?&]convite=([^&]+)/);
  const raw = (m1?.[1] || m2?.[1] || m3?.[1] || "").trim();
  try {
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    return raw || null;
  }
}

export function InventarianteRegistro() {
  const [status, setStatus] = useState("loading"); // loading | formulario | sucesso | erro
  const [token, setToken] = useState(null);
  const [convite, setConvite] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [duplicataAviso, setDuplicataAviso] = useState("");
  const [checandoDuplicata, setChecandoDuplicata] = useState(false);
  const debounceRef = useRef(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmaSenha: "",
    matricula: "",
    cargo: "",
  });

  const firebaseOk = isFirebaseConfigured();

  const { inp } = getAppStyles(false);

  const validateToken = async (tok) => {
    setError("");
    try {
      const found = await fsGetDocPublic("convites_inventariantes", tok);

      if (!found) {
        setStatus("erro");
        setError(
          "Convite não encontrado no sistema. Peça ao administrador um novo link — convites antigos podem não ter sido salvos corretamente."
        );
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
      const msg = String(err?.message || "");
      if (msg.includes("Firestore") || msg.includes("PERMISSION") || msg.includes("permission")) {
        setError("Convite bloqueado pelas regras do Firestore. O administrador precisa publicar as regras atualizadas no Firebase Console.");
      } else {
        setError(msg || "Erro ao validar o link. Verifique sua conexão e tente novamente.");
      }
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
          papel: "inventariante",
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

  const handleSubmit = async () => {
    setError("");

    if (!formData.nome.trim()) { setError("Nome completo é obrigatório"); return; }
    if (!formData.email.trim()) { setError("E-mail é obrigatório"); return; }
    if (!formData.matricula.trim()) { setError("Matrícula é obrigatória"); return; }
    if (!formData.senha || formData.senha.length < 6) { setError("Senha deve ter no mínimo 6 caracteres"); return; }
    if (formData.senha !== formData.confirmaSenha) { setError("As senhas não conferem"); return; }

    setSubmitting(true);
    try {
      const dupPre = await verificarCadastroDuplicado({
        email: formData.email.trim(),
        matricula: formData.matricula.trim(),
        nome: formData.nome.trim(),
        papel: "inventariante",
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
        papel: "inventariante",
        excludeUid: user.uid,
      });
      if (dupPos.blocked) {
        setError(
          dupPos.message + " A conta foi criada, mas o cadastro não foi concluído. Contate o administrador."
        );
        return;
      }

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
      await fsSetStrict("inventariantes", user.uid, invData);

      try {
        await registrarCadastroIndice({
          uid: user.uid,
          email: formData.email.trim(),
          matricula: formData.matricula.trim(),
          nome: formData.nome.trim(),
          papel: "inventariante",
          status: "pendente_aprovacao",
        });
      } catch (idxErr) {
        console.warn("Índice anti-duplicação não gravado:", idxErr);
      }

      try {
        await marcarConviteInventarianteUsado(token, convite, user.uid);
      } catch (markErr) {
        console.warn("Convite não marcado como usado:", markErr);
      }

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

  if (status === "loading") {
    return (
      <div className="gov-loading">
        <div className="gov-spinner" aria-hidden="true" />
        <p style={{ color: "var(--gov-text-muted)", fontSize: 13 }}>Validando convite...</p>
      </div>
    );
  }

  if (status === "erro") {
    return (
      <AuthPageLayout title="Link inválido" subtitle="Não foi possível validar o convite" footer="Contate o administrador para receber um novo link">
        <div className="gov-alert gov-alert--danger">{error}</div>
      </AuthPageLayout>
    );
  }

  if (status === "sucesso") {
    return (
      <AuthPageLayout title="Cadastro realizado!" subtitle={`Bem-vindo(a), ${formData.nome}!`} footer="Secretaria Municipal — SEMCAS">
        <div className="gov-alert gov-alert--info" style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontWeight: 700, marginBottom: 6 }}>Próximo passo</p>
          <p style={{ margin: 0 }}>
            Seu cadastro foi enviado para aprovação. O administrador analisará suas informações e liberará o acesso em breve.
          </p>
        </div>
        <button
          type="button"
          className="gov-btn gov-btn--primary"
          style={{ width: "100%" }}
          onClick={() => {
            try { window.location.href = import.meta.env.BASE_URL || "/"; } catch {}
          }}
        >
          Ir para o Login
        </button>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      badge="Cadastro"
      title="Cadastro de inventariante"
      subtitle="Preencha os dados abaixo para solicitar acesso"
      footer="Após o cadastro, aguarde a aprovação do administrador"
    >
      <div className="gov-alert gov-alert--success" style={{ marginBottom: 16 }}>
        Convite válido até {new Date(convite?.dataExpiracao).toLocaleDateString("pt-BR")}
      </div>

      {duplicataAviso && (
        <div className="gov-alert gov-alert--warning" style={{ marginBottom: 16 }}>
          {duplicataAviso}
        </div>
      )}
      {checandoDuplicata && !duplicataAviso && (
        <p style={{ fontSize: 12, color: "var(--gov-text-muted)", marginBottom: 12 }}>Verificando duplicidade...</p>
      )}

      {error && <div className="gov-alert gov-alert--danger" style={{ marginBottom: 16 }}>{error}</div>}

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
          type="button"
          onClick={handleSubmit}
          disabled={submitting || Boolean(duplicataAviso)}
          className="gov-btn gov-btn--primary"
          style={{ width: "100%", marginTop: 4, opacity: submitting ? 0.8 : 1 }}
        >
          {submitting ? "Cadastrando..." : "Criar conta"}
        </button>
      </div>
    </AuthPageLayout>
  );
}
