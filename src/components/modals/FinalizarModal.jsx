import React from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput } from "../FormFields.jsx";

export function FinalizarModal({
  isMob,
  setModal,
  inventario,
  getField,
  setField,
  finalizarComCoordenadora,
  bs,
  bp,
  inp,
}) {
  return (
    <Overlay isMobile={isMob} onClose={() => setModal(null)}>
      <div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Finalizar inventário</h2>
        <p style={{ color: "#64748b", margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
          {inventario.unidadesAtivas.length === 1
            ? inventario.unidadesAtivas[0].nome
            : `${inventario.unidadesAtivas.length} unidades em inventário`}
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#15803d", lineHeight: 1.45, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
          Finalizar encerra a sessão ativa, mas o inventário continua editável na aba <strong>Finalizados</strong> — ajustes, locais e ligação de mobiliário permanecem disponíveis.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#15803d" }}>{inventario.totalFound}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Encontrados</p>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#b91c1c" }}>{inventario.totalBens - inventario.totalFound}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Não encontrados</p>
          </div>
        </div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Dados da coordenadora</p>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#475569" }}>Nome completo</p>
          <TInput initial={getField("coordNome")} onVal={(v) => setField("coordNome", v)} placeholder="Ex: Maria Silva" style={{ ...inp, marginBottom: 10 }} />
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#475569" }}>Matrícula</p>
          <TInput initial={getField("coordMatricula")} onVal={(v) => setField("coordMatricula", v)} placeholder="Ex: 123456" style={inp} />
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
            Será gerado um link e QR Code. A coordenadora se cadastra pelo link; o administrador aprova em Coordenadores.
          </p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
            Cancelar
          </button>
          <button onClick={finalizarComCoordenadora} style={{ ...bp, flex: 1 }}>
            Gerar link e QR Code
          </button>
        </div>
      </div>
    </Overlay>
  );
}
