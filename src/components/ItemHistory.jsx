import React, { useEffect, useState } from "react";
import { obterHistoricoItem } from "../services/audit.js";

const ACAO_LABEL = {
  create: "Cadastro",
  update: "Alteração",
  "queue-save": "Salvo offline",
  "link-tombo": "Vínculo de tombo",
};

export function ItemHistory({ itemId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !itemId) return;
    let alive = true;
    setLoading(true);
    obterHistoricoItem(itemId, 25)
      .then((rows) => {
        if (!alive) return;
        setLogs(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, itemId]);

  if (!itemId) return null;

  return (
    <div style={{ marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "#f8fafc",
          border: "none",
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 800,
          color: "#334155",
          cursor: "pointer",
        }}
      >
        {open ? "▾" : "▸"} Histórico do item
      </button>
      {open && (
        <div style={{ padding: "10px 12px", maxHeight: 220, overflowY: "auto", background: "#fff" }}>
          {loading ? (
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Carregando...</p>
          ) : logs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Nenhum registro de alteração.</p>
          ) : (
            logs.map((log) => {
              const dt = log.timestamp ? new Date(log.timestamp) : null;
              const when = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString("pt-BR") : "—";
              const mud = Array.isArray(log.mudancas) ? log.mudancas : [];
              const campos = mud.slice(0, 4).map((m) => m.campo).filter(Boolean);
              return (
                <div key={log._id || log.timestamp} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                    {ACAO_LABEL[log.acao] || log.acao || "Evento"} · {when}
                  </p>
                  {campos.length > 0 && (
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b" }}>
                      Campos: {campos.join(", ")}
                      {mud.length > 4 ? "…" : ""}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
