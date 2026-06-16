import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearFirebaseSession,
  fbLogin,
  fbRegister,
  obterCoordPorUid,
  obterInventariantePorUid,
  refreshAuthToken,
  setFirebaseSession,
} from "../services/firebase.js";
import { CoordRedirectError, isCoordRedirectError, redirectToCoordLogin } from "../utils/coordRedirect.js";
import { isAdminUid } from "../constants/auth.js";

async function resolveLoginRole(user) {
  if (isAdminUid(user.uid)) {
    user.role = "admin";
    return user;
  }

  const invEntry = await obterInventariantePorUid(user.uid);
  if (invEntry) {
    if (invEntry.status === "pendente_aprovacao") {
      throw new Error("Sua conta está aguardando aprovação do administrador. Tente novamente em breve.");
    }
    if (invEntry.status === "rejeitado") {
      throw new Error("Seu acesso foi rejeitado. Entre em contato com o administrador.");
    }
    if (invEntry.status === "desativado") {
      throw new Error("Sua conta foi desativada. Entre em contato com o administrador.");
    }
    user.nome = invEntry.nome || user.nome;
    user.role = "inventariante";
    return user;
  }

  const coordEntry = await obterCoordPorUid(user.uid);
  if (coordEntry) {
    if (coordEntry.status === "pendente_aprovacao") {
      throw new Error("Sua conta de coordenadora aguarda aprovação. Entre em contato com o administrador.");
    }
    if (coordEntry.status === "rejeitada") {
      throw new Error("Seu acesso de coordenadora foi rejeitado.");
    }
    if (coordEntry.status === "desativada") {
      throw new Error("Seu acesso de coordenadora foi revogado.");
    }
    if (coordEntry.status === "aprovada") {
      throw new CoordRedirectError(user);
    }
    throw new Error("Conta de coordenadora sem permissão de acesso.");
  }

  throw new Error("Acesso não autorizado. Cadastre-se via convite de inventariante ou use a conta de coordenadora.");
}

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

  const loadAfterAuthRef = useRef(loadAfterAuth);
  const showTRef = useRef(showT);
  useEffect(() => {
    loadAfterAuthRef.current = loadAfterAuth;
  }, [loadAfterAuth]);
  useEffect(() => {
    showTRef.current = showT;
  }, [showT]);

  // Rede de segurança: nunca deixar o usuário preso em "Carregando inventário..."
  // por mais que algum await silencioso dentro do boot trave. Após 8s, força
  // loading=false; se boot termina antes (caso comum), esse timeout vira no-op.
  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    async function boot() {
      if (!firebaseOk) {
        setLoading(false);
        return;
      }

      const hard = setTimeout(() => setLoading(false), 8000);
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
        if (!saved) {
          clearTimeout(hard);
          setLoading(false);
          return;
        }
        const s = JSON.parse(saved);
        if (s.refreshToken) {
          try {
            const r = await refreshAuthToken(s.refreshToken);
            const next = { ...s, token: r.token, uid: r.uid, refreshToken: r.refreshToken || s.refreshToken };
            setFirebaseSession({ token: next.token, uid: next.uid });

            try {
              await resolveLoginRole(next);
            } catch (roleErr) {
              clearTimeout(hard);
              if (isCoordRedirectError(roleErr)) {
                redirectToCoordLogin(roleErr.user || next);
                setLoading(false);
                return;
              }
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
          try {
            await resolveLoginRole(s);
            setLogado(s);
          } catch (roleErr) {
            clearTimeout(hard);
            if (isCoordRedirectError(roleErr)) {
              redirectToCoordLogin(roleErr.user || s);
              setLoading(false);
              return;
            }
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
        }

        try {
          await loadAfterAuthRef.current?.();
        } finally {
          clearTimeout(hard);
          setLoading(false);
        }
      } catch (e) {
        try {
          showTRef.current?.(e?.message || "Erro ao iniciar");
        } catch {}
      } finally {
        clearTimeout(hard);
        setLoading(false);
      }
    }
    boot();
  }, [firebaseOk]);

  // Renova o token a cada 45min enquanto a aba está visível. Tokens do
  // Firebase Identity Toolkit expiram em 1h — sem isso, depois de uma hora
  // de uso as queries começam a retornar 401 silenciosamente.
  useEffect(() => {
    if (!logado?.uid) return;
    const REFRESH_MS = 45 * 60 * 1000;
    let timer = null;
    const tick = async () => {
      try {
        let saved = null;
        try {
          saved = sessionStorage.getItem("inv-session");
        } catch {}
        if (!saved) return;
        const s = JSON.parse(saved);
        if (!s?.refreshToken) return;
        const r = await refreshAuthToken(s.refreshToken);
        const next = { ...s, token: r.token, uid: r.uid, refreshToken: r.refreshToken || s.refreshToken };
        setFirebaseSession({ token: next.token, uid: next.uid });
        try {
          sessionStorage.setItem("inv-session", JSON.stringify(next));
        } catch {}
      } catch (e) {
        console.warn("Falha ao renovar token:", e?.message || e);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [logado?.uid]);

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

        if (loginMode !== "login") {
          clearFirebaseSession();
          setLoginError("Cadastro apenas via convite. Use o link enviado pelo administrador.");
          return null;
        }

        if (loginMode === "login") {
          try {
            await resolveLoginRole(user);
          } catch (roleErr) {
            if (isCoordRedirectError(roleErr)) {
              redirectToCoordLogin(roleErr.user || user);
              return null;
            }
            clearFirebaseSession();
            setLoginError(roleErr?.message || "Acesso negado");
            return null;
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
        try {
          await loadAfterAuth?.();
        } finally {
          setLoading(false);
        }

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

