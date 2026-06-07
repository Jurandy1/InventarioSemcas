const COORD_SESSION_KEY = "inv-coord-session";

export class CoordRedirectError extends Error {
  constructor(user) {
    super("Redirecionando para área da coordenadora...");
    this.name = "CoordRedirectError";
    this.user = user;
  }
}

export function getCoordLoginUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${window.location.origin}${prefix}#/coord/`;
}

export function saveCoordSession(user) {
  if (!user?.token || !user?.uid) return;
  try {
    sessionStorage.setItem(
      COORD_SESSION_KEY,
      JSON.stringify({
        token: user.token,
        uid: user.uid,
        refreshToken: user.refreshToken || "",
        email: user.email || "",
      }),
    );
  } catch {}
}

export function loadCoordSession() {
  try {
    const raw = sessionStorage.getItem(COORD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCoordSession() {
  try {
    sessionStorage.removeItem(COORD_SESSION_KEY);
  } catch {}
}

export function redirectToCoordLogin(user) {
  saveCoordSession(user);
  try {
    sessionStorage.removeItem("inv-session");
  } catch {}
  try {
    localStorage.removeItem("inv-session");
  } catch {}
  window.location.href = getCoordLoginUrl();
}

export function isCoordRedirectError(err) {
  return err instanceof CoordRedirectError || err?.name === "CoordRedirectError";
}
