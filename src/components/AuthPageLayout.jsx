import React from "react";

export function AuthPageLayout({ title, subtitle, badge, children, footer }) {
  return (
    <div className="gov-auth-page">
      <header className="gov-header">
        <div className="gov-header__flag" aria-hidden="true" />
        <div className="gov-header__inner">
          <div className="gov-brand">
            <div className="gov-brand__seal" aria-hidden="true">
              S
            </div>
            <div>
              <p className="gov-brand__org">Secretaria Municipal — SEMCAS</p>
              <p className="gov-brand__sys">Sistema de Inventário Patrimonial</p>
            </div>
          </div>
        </div>
      </header>

      <main className="gov-auth-main">
        <div className="gov-auth-card">
          {badge ? <span className="gov-tag">{badge}</span> : null}
          <h1 className="gov-auth-title">{title}</h1>
          {subtitle ? <p className="gov-auth-subtitle">{subtitle}</p> : null}
          {children}
        </div>
      </main>

      {footer ? <footer className="gov-auth-footer">{footer}</footer> : null}
    </div>
  );
}
