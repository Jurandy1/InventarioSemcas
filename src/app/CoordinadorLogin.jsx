import React, { useEffect, useState } from "react";
import { clearFirebaseSession, fbLogin, isFirebaseConfigured, obterCoordPorUid } from "../services/firebase.js";
import { CoordinadorPage } from "./CoordinadorPage.jsx";

export function CoordinadorLogin() {
  const [status, setStatus] = useState("login");
  const [token, setToken] = useState(null);
  const [coordData, setCoordData] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  const firebaseOk = isFirebaseConfigured();

  const validateCoord = async (uid) => {
    try {
      setError("");
      const found = await obterCoordPorUid(uid);

      if (!found) throw new Error("Acesso de coordenadora não encontrado");
      if (found.status === "rejeitada") throw new Error("Seu acesso foi rejeitado pelo administrador");
      if (found.status === "desativada") throw new Error("Seu acesso foi revogado");
      if (found.status !== "aprovada") throw new Error("Aguarde aprovação do administrador");

      setToken(uid);
      setCoordData(found);
      setStatus("dashboard");
    } catch (err) {
      console.error("Erro ao validar coordenadora:", err);
      clearFirebaseSession();
      setToken(null);
      setCoordData(null);
      setStatus("login");
      setError(err?.message || "Erro ao acessar o sistema");
    }
  };

  useEffect(() => {
    async function boot() {
      clearFirebaseSession();
      setStatus("login");
    }
    boot();
  }, [firebaseOk]);

  if (status === "dashboard" && token && coordData) {
    return (
      <CoordinadorPage
        token={token}
        coordData={coordData}
        onLogout={() => {
          setStatus("login");
          setToken(null);
          setCoordData(null);
          setEmail("");
          setSenha("");
          setError("");
          clearFirebaseSession();
          try {
            window.history.replaceState({}, "", `${import.meta.env.BASE_URL}#/coord/`);
          } catch {}
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #6b21a8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: "12px 0 4px", fontSize: 20, fontWeight: 700 }}>Acesso Coordenadora</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Inventário SEMCAS</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#991b1b" }}>{error}</p>
          </div>
        )}

        {!firebaseOk && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9a3412" }}>Firebase não configurado</p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9a3412" }}>Configure VITE_FB_API_KEY, VITE_FB_PROJECT_ID e VITE_FB_STORAGE_BUCKET.</p>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
          />
        </div>

        <button
          disabled={!firebaseOk}
          onClick={async () => {
            try {
              setError("");
              const em = email.trim();
              const pw = senha;
              if (!em || !pw) {
                setError("Informe email e senha");
                return;
              }
              setStatus("loading");
              const user = await fbLogin(em, pw);
              await validateCoord(user.uid);
            } catch (e) {
              clearFirebaseSession();
              setStatus("login");
              setError(e?.message || "Falha ao entrar");
            }
          }}
          style={{ width: "100%", background: "#6b21a8", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: firebaseOk ? 1 : 0.7 }}
        >
          {status === "loading" ? "Entrando..." : "Entrar"}
        </button>

        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
          Esta página é exclusiva para coordenadoras de unidades.
          <br />
          Você terá acesso limitado aos itens da sua unidade.
        </p>
      </div>
    </div>
  );
}
