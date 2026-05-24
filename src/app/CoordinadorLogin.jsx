import React, { useEffect, useState } from "react";
import { fsGetAll, fbAnonymousLogin, isFirebaseConfigured } from "../services/firebase.js";
import { CoordinadorPage } from "./CoordinadorPage.jsx";

function getTokenFromLocation() {
  const path = String(window.location.pathname || "");
  const hash = String(window.location.hash || "");
  const m1 = path.match(/\/coord\/([^/]+)/);
  const m2 = hash.match(/#\/coord\/([^/?]+)/);
  return (m1?.[1] || m2?.[1] || "").trim() || null;
}

export function CoordinadorLogin() {
  const [status, setStatus] = useState("loading");
  const [token, setToken] = useState(null);
  const [coordData, setCoordData] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [error, setError] = useState("");

  const firebaseOk = isFirebaseConfigured();

  const validateToken = async (tok) => {
    try {
      setError("");
      const coordDocs = await fsGetAll("coordenadores");
      const found = coordDocs.find((c) => c?._id === tok || c?.token === tok);
      if (found && found.ativa) {
        setToken(tok);
        setCoordData(found);
        setStatus("dashboard");
      } else {
        setToken(null);
        setCoordData(null);
        setStatus("login");
        setError("Token inválido ou expirado");
      }
    } catch (err) {
      console.error("Erro ao validar token:", err);
      setToken(null);
      setCoordData(null);
      setStatus("login");
      setError("Erro ao acessar o sistema");
    }
  };

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setStatus("login");
        setError("Firebase não configurado");
        return;
      }
      try {
        await fbAnonymousLogin();
      } catch (e) {
        setStatus("login");
        setError(e.message || "Falha ao iniciar sessão");
        return;
      }

      const tok = getTokenFromLocation();
      if (tok) {
        await validateToken(tok);
      } else {
        setStatus("login");
      }
    }
    boot();
  }, [firebaseOk]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f1f5f9", gap: 16 }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#6b21a8", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 13 }}>Validando acesso...</p>
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
          setManualToken("");
          setError("");
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
          <p style={{ fontSize: 40, margin: 0 }}>👩‍💼</p>
          <h1 style={{ margin: "12px 0 4px", fontSize: 20, fontWeight: 700 }}>Acesso Coordenadora</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Inventário SEMCAS</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#991b1b" }}>{error}</p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Token de acesso</label>
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Cole o código aqui ou use o QR..."
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "monospace", boxSizing: "border-box", outline: "none" }}
          />
        </div>

        <button
          disabled={!firebaseOk}
          onClick={() => {
            setError("");
            const tok = manualToken.trim();
            if (!tok) {
              setError("Digite ou cole o código");
              return;
            }
            validateToken(tok);
          }}
          style={{ width: "100%", background: "#6b21a8", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: firebaseOk ? 1 : 0.7 }}
        >
          ✓ Acessar
        </button>

        <div style={{ position: "relative", margin: "16px 0" }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "#e2e8f0", transform: "translateY(-50%)" }} />
          <p style={{ position: "relative", background: "#fff", padding: "0 12px", margin: 0, textAlign: "center", fontSize: 12, color: "#94a3b8", display: "inline-block", left: "50%", transform: "translateX(-50%)" }}>
            ou escanear QR code
          </p>
        </div>

        <div style={{ background: "#f9f3ff", border: "2px dashed #d8b4fe", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <p style={{ fontSize: 32, margin: 0 }}>📱</p>
          <p style={{ fontSize: 12, color: "#6b21a8", margin: "8px 0 0", fontWeight: 600 }}>Abra a câmera do celular e aponte para o QR code fornecido pela administração</p>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
          Esta página é exclusiva para coordenadoras de unidades.
          <br />
          Você terá acesso limitado aos itens da sua unidade.
        </p>
      </div>
    </div>
  );
}
