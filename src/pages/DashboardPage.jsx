import React from "react";
import { Badge } from "../components/Badge.jsx";
import { EC } from "../constants/inventory.js";

export function DashboardPage({
  totalBens,
  totalFound,
  progresso,
  gerarRelatorio,
  fazerBackup,
  found,
  xlsxCorrompidos,
  unidades,
  saveAtiva,
  setTab,
  showT,
  isMob,
  bp,
  bs,
  cd,
  campanha,
  campanhaFechada,
  onFecharCampanha,
  onReabrirCampanha,
  isAdmin,
}) {
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Dashboard</h2>

      {isAdmin && (
        <div style={{ ...cd, marginBottom: 16, border: campanhaFechada ? "1.5px solid #fecaca" : "1.5px solid #bbf7d0", background: campanhaFechada ? "#fef2f2" : "#f0fdf4" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: campanhaFechada ? "#991b1b" : "#166534" }}>
            Campanha: {campanha?.nome || "Inventário atual"} · {campanhaFechada ? "Fechada" : "Aberta"}
          </p>
          {campanha?.fim && campanhaFechada && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>Fechada em {new Date(campanha.fim).toLocaleString("pt-BR")}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {!campanhaFechada ? (
              <button
                onClick={async () => {
                  if (!window.confirm("Fechar o inventário? Ninguém poderá registrar novos itens.")) return;
                  await onFecharCampanha?.();
                  showT("Inventário fechado");
                }}
                style={{ ...bs, fontSize: 12, color: "#991b1b", borderColor: "#fca5a5" }}
              >
                Fechar inventário
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!window.confirm("Reabrir o inventário para novos registros?")) return;
                  await onReabrirCampanha?.();
                  showT("Inventário reaberto");
                }}
                style={{ ...bp, fontSize: 12, background: "#166534" }}
              >
                Reabrir inventário
              </button>
            )}
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Total", v: totalBens, c: "#1351B4" },
          { l: "Encontrados", v: totalFound, c: "#16a34a" },
          { l: "Pendentes", v: totalBens - totalFound, c: "#dc2626" },
          { l: "Progresso", v: `${progresso}%`, c: "#7c3aed" },
        ].map((s) => (
          <div key={s.l} style={cd}>
            <p style={{ margin: 0, fontSize: isMob ? 20 : 28, fontWeight: 700, color: s.c }}>{s.v}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{s.l}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => gerarRelatorio("pdf")} style={{ ...bp, fontSize: 12 }}>
          PDF
        </button>
        <button onClick={() => gerarRelatorio("excel")} style={{ ...bp, fontSize: 12, background: "#0f766e" }}>
          Excel
        </button>
        <button onClick={fazerBackup} style={{ ...bs, fontSize: 12 }}>
          Backup
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, marginTop: 20 }}>Últimos a inventariar</h3>
      <div style={{ ...cd, marginBottom: 16 }}>
        {(() => {
          const userMap = {};
          for (const f of found) {
            const usuario = f.usuario || f.user;
            if (!usuario) continue;
            const ts = f.ultimaAtualizacao ? new Date(f.ultimaAtualizacao).getTime() : 0;
            if (!userMap[usuario]) userMap[usuario] = { count: 0, lastTime: ts };
            userMap[usuario].count += 1;
            if (ts > userMap[usuario].lastTime) userMap[usuario].lastTime = ts;
          }
          return Object.entries(userMap).length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Sem dados</p>
          ) : (
            Object.entries(userMap)
              .sort((a, b) => b[1].lastTime - a[1].lastTime)
              .slice(0, 5)
              .map(([usuario, data], idx, arr) => (
                <div key={usuario} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: idx === arr.length - 1 ? "none" : "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{usuario}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {data.count} item(ns){data.lastTime ? ` · ${new Date(data.lastTime).toLocaleString("pt-BR")}` : ""}
                  </span>
                </div>
              ))
          );
        })()}
      </div>

      {xlsxCorrompidos.length > 0 && (
        <div style={{ ...cd, border: "1.5px solid #fed7aa", background: "#fff7ed", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#9a3412" }}>Registros incompletos na planilha (XLSX): {xlsxCorrompidos.length}</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9a3412", fontWeight: 600, lineHeight: 1.35 }}>
            Alguns patrimônios estão com apenas o número preenchido e sem dados (NF, fornecedor, descrição, valores).
          </p>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {xlsxCorrompidos.slice(0, 10).map((i) => (
              <div key={`${i.unidadeId}_${i.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#fff", border: "1px solid #fed7aa" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: "#7c2d12" }}>Nº {i.id}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9a3412", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.unidadeNome}</p>
                </div>
                <button
                  onClick={() => {
                    const u = unidades.find((x) => x.id === i.unidadeId);
                    if (u) saveAtiva(u);
                    setTab("inventario");
                    showT("Abra o item para revisar os dados");
                  }}
                  style={{ ...bs, padding: "6px 10px", fontSize: 12 }}
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
          {xlsxCorrompidos.length > 10 && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9a3412" }}>Mostrando 10 de {xlsxCorrompidos.length}.</p>}
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Estado de Conservação</h3>
      <div style={cd}>
        {(() => {
          const ec = found.reduce((a, f) => {
            a[f.estado] = (a[f.estado] || 0) + 1;
            return a;
          }, {});
          return Object.entries(ec).length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Sem dados</p>
          ) : (
            Object.entries(ec).map(([e, c]) => (
              <div key={e} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <Badge label={e} c={EC[e]} />
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: "#e2e8f0" }}>
                  <div style={{ height: "100%", background: EC[e].tx, borderRadius: 3, width: `${(c / found.length) * 100}%` }} />
                </div>
                <span style={{ fontSize: 12, color: "#64748b" }}>{c}</span>
              </div>
            ))
          );
        })()}
      </div>
    </div>
  );
}

