import React from "react";

function NavIcon({ id, active, size = 18 }) {
  const color = active ? "#fff" : "#475569";
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "inventario":
      return (
        <svg {...common}>
          <rect x="8" y="4" width="12" height="18" rx="2" />
          <path d="M10 8h8" />
          <path d="M10 12h8" />
          <path d="M10 16h8" />
          <path d="M6 6h2" />
          <path d="M6 10h2" />
          <path d="M6 14h2" />
        </svg>
      );
    case "busca":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "itens":
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.3 7.5L12 12l8.7-4.5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "nf":
      return (
        <svg {...common}>
          <path d="M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );
    case "tombos":
      return (
        <svg {...common}>
          <path d="M20 12l-8 8-8-8 8-8h6l2 2v6z" />
          <path d="M14 7h.01" />
        </svg>
      );
    case "dash":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-8" />
          <path d="M22 20H2" />
        </svg>
      );
    case "coordenadores":
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
          <path d="M9 12l2 2 4-5" />
        </svg>
      );
    case "inventariantes":
      return (
        <svg {...common}>
          <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11z" />
          <path d="M8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11z" />
          <path d="M2 20c0-3 3-5 6-5" />
          <path d="M22 20c0-3-3-5-6-5" />
          <path d="M8 15c1.1-.6 2.4-1 4-1s2.9.4 4 1" />
          <path d="M6 20c0-3 2.7-5 6-5s6 2 6 5" />
        </svg>
      );
    default:
      return null;
  }
}

export function NavBar({
  navs,
  activeTab,
  onTabChange,
  isMobile,
  logado,
  unidadesAtivas,
  offlineStatus,
  banner,
  onReloadXlsx,
  loadingXlsx,
  onLogout,
  storageOk,
  children,
}) {
  return (
    <>
      <div
        style={{
          background: "#1e3a8a",
          color: "#fff",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 200,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Inventário SEMCAS</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
            {logado?.nome || ""}
            {unidadesAtivas?.length === 1
              ? ` · ${unidadesAtivas[0].nome}`
              : unidadesAtivas?.length > 1
              ? ` · ${unidadesAtivas.length} unidades em inventário`
              : ""}
          </p>
          <div style={{ marginTop: 3 }}>{offlineStatus}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {logado && (
            <button
              onClick={onReloadXlsx}
              style={{
                background: "rgba(255,255,255,.15)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {loadingXlsx ? "Atualizando..." : "Atualizar"}
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,.15)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {banner}

      <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto" }}>
        {!isMobile && (
          <div style={{ width: 210, background: "#fff", borderRight: "1px solid #e2e8f0", padding: 16, flexShrink: 0 }}>
            {navs.map((n) => (
              <button
                key={n.id}
                onClick={() => onTabChange(n.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  background: activeTab === n.id ? "#1e3a8a" : "transparent",
                  color: activeTab === n.id ? "#fff" : "#374151",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: 4,
                  textAlign: "left",
                  position: "relative",
                }}
              >
                <NavIcon id={n.id} active={activeTab === n.id} />
                <span>{n.l}</span>
                {n.badge && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: activeTab === n.id ? "rgba(255,255,255,.3)" : "#1e3a8a",
                      color: "#fff",
                      borderRadius: 99,
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "1px 6px",
                      minWidth: 16,
                      textAlign: "center",
                    }}
                  >
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "12px 0" }} />
            <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>{storageOk ? "Fotos: Firebase Storage OK" : "Fotos: Storage não configurado"}</p>
          </div>
        )}

        <div
          style={{
            flex: 1,
            padding: isMobile ? 12 : 24,
            paddingBottom: isMobile ? "calc(78px + env(safe-area-inset-bottom, 0px))" : 24,
          }}
        >
          {children}
        </div>
      </div>

      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#fff",
            borderTop: "1.5px solid #e2e8f0",
            display: "flex",
            zIndex: 200,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            boxShadow: "0 -6px 16px rgba(15,23,42,.08)",
          }}
        >
          {navs.map((n) => (
            <button
              key={n.id}
              onClick={() => onTabChange(n.id)}
              style={{
                flex: 1,
                minHeight: 56,
                padding: "10px 2px 8px",
                border: "none",
                background: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
                position: "relative",
              }}
            >
              {n.badge && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: "calc(50% - 14px)",
                    background: "#dc2626",
                    color: "#fff",
                    borderRadius: 99,
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 4px",
                    minWidth: 14,
                    textAlign: "center",
                    lineHeight: "14px",
                  }}
                >
                  {n.badge}
                </span>
              )}
              <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <NavIcon id={n.id} active={activeTab === n.id} size={20} />
              </div>
              <span style={{ fontSize: 10, fontWeight: activeTab === n.id ? 800 : 500, color: activeTab === n.id ? "#1e3a8a" : "#94a3b8" }}>
                {n.l}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
