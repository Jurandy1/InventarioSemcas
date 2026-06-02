import React from "react";

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
                  gap: 6,
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
                {n.l}
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
