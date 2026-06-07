import React from "react";
import { TInput } from "../components/FormFields.jsx";

export function LoginPage({ firebaseOk, isProd, loginMode, loginError, onEmail, onSenha, onSubmit, onToggleMode, inp, bp }) {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const registroUrl = `${prefix}#/invregistro/`;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e3a8a,#1e40af)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Inventário SEMCAS</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 24px" }}>Acesse sua conta</p>
        {!firebaseOk && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9a3412" }}>Firebase não configurado</p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9a3412" }}>{isProd ? "Configure os secrets no GitHub Actions e faça redeploy." : "Crie o arquivo .env com as variáveis do Firebase."}</p>
          </div>
        )}
        <TInput initial="" onVal={onEmail} type="email" placeholder="Email" style={{ ...inp, marginBottom: 12 }} />
        <TInput initial="" onVal={onSenha} type="password" placeholder="Senha" style={{ ...inp, marginBottom: 8 }} />
        {loginError && <p style={{ color: "#dc2626", fontSize: 12, fontWeight: 600, margin: "8px 0" }}>{loginError}</p>}
        <button disabled={!firebaseOk} onClick={onSubmit} style={{ ...bp, width: "100%", marginTop: 8, opacity: firebaseOk ? 1 : 0.6 }}>
          Entrar
        </button>
        <p style={{ fontSize: 12, color: "#64748b", margin: "16px 0 8px", lineHeight: 1.45 }}>
          Novo inventariante? Solicite um convite ao administrador e acesse:
        </p>
        <a href={registroUrl} style={{ display: "block", textAlign: "center", color: "#1e3a8a", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Cadastro com convite
        </a>
      </div>
    </div>
  );
}
