import React from "react";

function NavIcon({ id, active, size = 18 }) {
  const color = active ? "var(--gov-primary)" : "var(--gov-text-muted)";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
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
    case "finalizados":
      return (
        <svg {...common}>
          <path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1z" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 13l2 2 4-4" />
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
    case "correcao":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    default:
      return null;
  }
}

const MOBILE_NAV_LABELS = {
  inventario: "Inv.",
  finalizados: "Fin.",
  busca: "Busca",
  itens: "Itens",
  nf: "NF",
  tombos: "Tomb.",
  dash: "Dash",
  coordenadores: "Coord.",
  inventariantes: "Invit.",
  correcao: "Nomes",
};

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
  const unitLabel =
    unidadesAtivas?.length === 1
      ? unidadesAtivas[0].nome
      : unidadesAtivas?.length > 1
        ? `${unidadesAtivas.length} unidades em inventário`
        : "";

  return (
    <>
      <header className="gov-header">
        <div className="gov-header__flag" aria-hidden="true" />
        <div className="gov-header__inner">
          <div className="gov-brand">
            <div className="gov-brand__seal" aria-hidden="true">
              S
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="gov-brand__org">Secretaria Municipal — SEMCAS</p>
              <p className="gov-brand__sys">Inventário Patrimonial</p>
              {(logado?.nome || unitLabel) && (
                <p className="gov-header__meta">
                  {logado?.nome || ""}
                  {logado?.nome && unitLabel ? " · " : ""}
                  {unitLabel}
                </p>
              )}
              <div className="gov-header__status">{offlineStatus}</div>
            </div>
          </div>
          <div className="gov-header__actions">
            {logado && (
              <button type="button" className="gov-btn gov-btn--ghost gov-btn--compact-mobile" onClick={onReloadXlsx}>
                {loadingXlsx ? "…" : <span className="gov-btn__full-label">Atualizar base</span>}
                {!loadingXlsx && <span className="gov-btn__short-label" aria-hidden="true">↻</span>}
              </button>
            )}
            <button type="button" className="gov-btn gov-btn--ghost" onClick={onLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      {banner}

      <div className="gov-layout">
        {!isMobile && (
          <aside className="gov-sidebar">
            <nav aria-label="Menu principal">
              {navs.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onTabChange(n.id)}
                  className={`gov-nav-item${activeTab === n.id ? " gov-nav-item--active" : ""}`}
                >
                  <span className="gov-nav-icon">
                    <NavIcon id={n.id} active={activeTab === n.id} />
                  </span>
                  <span>{n.l}</span>
                  {n.badge ? <span className="gov-nav-badge">{n.badge}</span> : null}
                </button>
              ))}
            </nav>
            <div className="gov-sidebar-foot">
              {storageOk ? "Armazenamento de fotos: ativo" : "Armazenamento de fotos: não configurado"}
            </div>
          </aside>
        )}

        <main className={`gov-main${isMobile ? " gov-main--mobile" : ""}`} style={{ padding: isMobile ? 12 : 24 }}>
          {children}
        </main>
      </div>

      {isMobile && (
        <nav className="gov-bottom-nav" aria-label="Menu mobile">
          {navs.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onTabChange(n.id)}
              className={`gov-bottom-nav-item${activeTab === n.id ? " gov-bottom-nav-item--active" : ""}`}
            >
              {n.badge ? <span className="gov-bottom-nav-badge">{n.badge}</span> : null}
              <div style={{ height: 20, display: "flex", alignItems: "center" }}>
                <NavIcon id={n.id} active={activeTab === n.id} size={20} />
              </div>
              <span>{MOBILE_NAV_LABELS[n.id] || n.l}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
