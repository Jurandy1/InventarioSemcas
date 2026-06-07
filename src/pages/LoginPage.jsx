import React from "react";
import { AuthPageLayout } from "../components/AuthPageLayout.jsx";
import { TInput } from "../components/FormFields.jsx";

export function LoginPage({ firebaseOk, isProd, loginError, onEmail, onSenha, onSubmit, inp, bp }) {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const registroUrl = `${prefix}#/invregistro/`;

  return (
    <AuthPageLayout
      title="Acesso ao sistema"
      subtitle="Informe suas credenciais para continuar"
      footer="Inventário Patrimonial — Secretaria Municipal SEMCAS"
    >
      {!firebaseOk && (
        <div className="gov-alert gov-alert--warning" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Firebase não configurado</p>
          <p style={{ margin: "6px 0 0" }}>
            {isProd ? "Configure os secrets no GitHub Actions e faça redeploy." : "Crie o arquivo .env com as variáveis do Firebase."}
          </p>
        </div>
      )}
      <TInput initial="" onVal={onEmail} type="email" placeholder="E-mail institucional" style={{ ...inp, marginBottom: 12 }} />
      <TInput initial="" onVal={onSenha} type="password" placeholder="Senha" style={{ ...inp, marginBottom: 8 }} />
      {loginError && (
        <div className="gov-alert gov-alert--danger" style={{ margin: "12px 0" }}>
          {loginError}
        </div>
      )}
      <button
        type="button"
        className="gov-btn gov-btn--primary"
        disabled={!firebaseOk}
        onClick={onSubmit}
        style={{ width: "100%", marginTop: 8, opacity: firebaseOk ? 1 : 0.6 }}
      >
        Entrar
      </button>
      <p style={{ fontSize: 12, color: "var(--gov-text-muted)", margin: "20px 0 10px", lineHeight: 1.45 }}>
        Novo inventariante? Solicite um convite ao administrador:
      </p>
      <a href={registroUrl} className="gov-link" style={{ display: "block", textAlign: "center", fontSize: 13 }}>
        Cadastro com convite
      </a>
    </AuthPageLayout>
  );
}
