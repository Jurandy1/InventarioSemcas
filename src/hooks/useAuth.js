import { useCallback, useEffect, useState } from "react";
import {
  clearFirebaseSession,
  fbLogin,
  fbRegister,
  obterInventariantePorUid,
  refreshAuthToken,
  setFirebaseSession,
} from "../services/firebase.js";

export function useAuth({ firebaseOk, loadAfterAuth, showT } = {}) {
  const [logado, setLogado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [loginMode, setLoginMode] = useState("login");

  const logout = useCallback(() => {
    setLogado(null);
    clearFirebaseSession();
    try {
      sessionStorage.removeItem("inv-session");
    } catch {}
    try {
      localStorage.removeItem("inv-session");
    } catch {}
  }, []);

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setLoading(false);
        return;
      }

      const hard = setTimeout(() => setLoading(false), 15000);
      try {
        let saved = null;
        try {
          saved = sessionStorage.getItem("inv-session");
        } catch {}
        if (!saved) {
          try {
            saved = localStorage.getItem("inv-session");
          } catch {}
        }
        if (!saved) return;
        const s = JSON.parse(saved);
        if (s.refreshToken) {
          try {
            const r = await refreshAuthToken(s.refreshToken);
            const next = { ...s, token: r.token, uid: r.uid, refreshToken: r.refreshToken || s.refreshToken };
            setFirebaseSession({ token: next.token, uid: next.uid });
            setLogado(next);
            try {
              sessionStorage.setItem("inv-session", JSON.stringify(next));
            } catch {}
            try {
              localStorage.removeItem("inv-session");
            } catch {}
          } catch {
            setLogado(null);
            clearFirebaseSession();
            try {
              sessionStorage.removeItem("inv-session");
            } catch {}
            try {
              localStorage.removeItem("inv-session");
            } catch {}
            setLoading(false);
            return;
          }
        } else {
          setFirebaseSession({ token: s.token, uid: s.uid });
          setLogado(s);
        }

        await loadAfterAuth?.();
      } catch (e) {
        try {
          showT?.(e?.message || "Erro ao iniciar");
        } catch {}
      } finally {
        clearTimeout(hard);
        setLoading(false);
      }
    }
    boot();
  }, [firebaseOk, loadAfterAuth, showT]);

  const login = useCallback(
    async (email, senha) => {
      if (!firebaseOk) {
        setLoginError("Firebase não configurado.");
        return null;
      }
      if (!email?.trim() || !senha?.trim()) {
        setLoginError("Preencha email e senha");
        return null;
      }
      setLoginError("");

      try {
        const user = loginMode === "login" ? await fbLogin(email, senha) : await fbRegister(email, senha);

        if (loginMode === "login") {
          try {
            const invEntry = await obterInventariantePorUid(user.uid);
            if (invEntry) {
              if (invEntry.status === "pendente_aprovacao") {
                clearFirebaseSession();
                setLoginError("Sua conta está aguardando aprovação do administrador. Tente novamente em breve.");
                return null;
              }
              if (invEntry.status === "rejeitado") {
                clearFirebaseSession();
                setLoginError("Seu acesso foi rejeitado. Entre em contato com o administrador.");
                return null;
              }
              if (invEntry.status === "desativado") {
                clearFirebaseSession();
                setLoginError("Sua conta foi desativada. Entre em contato com o administrador.");
                return null;
              }
              user.nome = invEntry.nome || user.nome;
              user.role = "inventariante";
            } else {
              user.role = "admin";
            }
          } catch {
            user.role = "admin";
          }
        }

        setLogado(user);
        try {
          sessionStorage.setItem("inv-session", JSON.stringify(user));
        } catch {}
        try {
          localStorage.removeItem("inv-session");
        } catch {}

        setLoading(true);
        await loadAfterAuth?.();
        setLoading(false);

        showT?.(`Bem-vindo, ${user.nome}!`);
        return user;
      } catch (err) {
        setLoginError(err?.message || "Erro ao fazer login");
        return null;
      }
    },
    [firebaseOk, loadAfterAuth, loginMode, showT]
  );

  return { logado, loading, loginError, loginMode, setLoginMode, login, logout, setLogado, setLoginError };
}

