import React from "react";
import { lazyWithRetry } from "../utils/lazyWithRetry.js";

export const tabFallback = (
  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>Carregando aba…</div>
);

export const LazyTombosPage = lazyWithRetry(() => import("../pages/TombosPage.jsx").then((m) => ({ default: m.TombosPage })));
export const LazyDashboardPage = lazyWithRetry(() => import("../pages/DashboardPage.jsx").then((m) => ({ default: m.DashboardPage })));
export const LazyInventarioPage = lazyWithRetry(() => import("../pages/InventarioPage.jsx").then((m) => ({ default: m.InventarioPage })));
export const LazyBuscaPage = lazyWithRetry(() => import("../pages/BuscaPage.jsx").then((m) => ({ default: m.BuscaPage })));
export const LazyItensPage = lazyWithRetry(() => import("../pages/ItensPage.jsx").then((m) => ({ default: m.ItensPage })));
export const LazyNotasFiscaisPage = lazyWithRetry(() => import("../pages/NotasFiscaisPage.jsx").then((m) => ({ default: m.NotasFiscaisPage })));
export const LazyFinalizadosPage = lazyWithRetry(() => import("../pages/FinalizadosPage.jsx").then((m) => ({ default: m.FinalizadosPage })));
export const LazyCorrecaoNomesPage = lazyWithRetry(() => import("../pages/CorrecaoNomesPage.jsx").then((m) => ({ default: m.CorrecaoNomesPage })));
