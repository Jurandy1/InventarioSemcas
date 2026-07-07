import React, { useEffect, useState } from "react";
import { AuthPageLayout } from "../../components/AuthPageLayout.jsx";
import { getAppStyles } from "../../constants/theme.js";
import { clearFirebaseSession, fbLogin, isFirebaseConfigured, obterCoordPorUid, refreshAuthToken, setFirebaseSession } from "../../services/firebase.js";
import { clearCoordSession, loadCoordSession, saveCoordSession } from "../../utils/coordRedirect.js";
import { CoordinadorPage } from "./CoordinadorPage.jsx";

export function CoordinadorLogin() {
  const [status, setStatus] = useState("login");
  const [token, setToken] = useState(null);
  const [coordData, setCoordData] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  const firebaseOk = isFirebaseConfigured();
  const { inp } = getAppStyles(false);

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
      clearCoordSession();
      clearFirebaseSession();
      setToken(null);
      setCoordData(null);
      setStatus("login");
      setError(err?.message || "Erro ao acessar o sistema");
    }
  };

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setStatus("login");
        return;
      }

      const saved = loadCoordSession();
      if (!saved) {
        clearFirebaseSession();
        setStatus("login");
        return;
      }

      setStatus("loading");
      try {
        let session = saved;
        if (saved.refreshToken) {
          try {
            const r = await refreshAuthToken(saved.refreshToken);
            session = {
              ...saved,
              token: r.token,
              uid: r.uid,
              refreshToken: r.refreshToken || saved.refreshToken,
            };
            saveCoordSession(session);
          } catch {
            clearCoordSession();
            clearFirebaseSession();
            setStatus("login");
            return;
          }
        }

        setFirebaseSession({ token: session.token, uid: session.uid });
        if (session.email) setEmail(session.email);
        await validateCoord(session.uid);
      } catch {
        clearCoordSession();
        clearFirebaseSession();
        setStatus("login");
      }
    }
    boot();
  }, [firebaseOk]);

  if (status === "loading") {
    return (
      <div className="gov-loading">
        <div className="gov-spinner" aria-hidden="true" />
        <p style={{ color: "var(--gov-text-muted)", fontSize: 13 }}>Entrando...</p>
      </div>
    );
  }

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
          clearCoordSession();
          clearFirebaseSession();
          try {
            window.history.replaceState({}, "", `${import.meta.env.BASE_URL}#/coord/`);
          } catch {}
        }}
      />
    );
  }

  return (
    <AuthPageLayout
      badge="Coordenadoria"
      title="Acesso da coordenadora"
      subtitle="Painel exclusivo para acompanhamento do inventário da unidade"
      footer="Acesso limitado aos itens da sua unidade — SEMCAS"
    >
      {error && <div className="gov-alert gov-alert--danger" style={{ marginBottom: 16 }}>{error}</div>}

      {!firebaseOk && (
        <div className="gov-alert gov-alert--warning" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Firebase não configurado</p>
          <p style={{ margin: "6px 0 0" }}>Configure VITE_FB_API_KEY, VITE_FB_PROJECT_ID e VITE_FB_STORAGE_BUCKET.</p>
        </div>
      )}

      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gov-text)", marginBottom: 6 }}>E-mail</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        style={{ ...inp, marginBottom: 12 }}
      />

      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gov-text)", marginBottom: 6 }}>Senha</label>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Sua senha"
        style={{ ...inp, marginBottom: 16 }}
      />

      <button
        type="button"
        className="gov-btn gov-btn--primary"
        disabled={!firebaseOk}
        style={{ width: "100%", opacity: firebaseOk ? 1 : 0.7 }}
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
            saveCoordSession(user);
            await validateCoord(user.uid);
          } catch (e) {
            clearCoordSession();
            clearFirebaseSession();
            setStatus("login");
            setError(e?.message || "Falha ao entrar");
          }
        }}
      >
        Entrar
      </button>
    </AuthPageLayout>
  );
}
