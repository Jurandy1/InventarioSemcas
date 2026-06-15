import React from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput } from "../FormFields.jsx";

export function AddLocalModal({
  isMob,
  setModal,
  setField,
  getField,
  createSessionLocal,
  showT,
  bs,
  bp,
  inp,
}) {
  return (
    <Overlay isMobile={isMob} onClose={() => setModal(null)}>
      <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Novo Local</h2>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Nome *</label>
      <TInput initial="" onVal={(v) => setField("localNome", v)} placeholder="Ex: Sala de Reunião..." style={inp} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Descrição</label>
      <TInput initial="" onVal={(v) => setField("localDesc", v)} placeholder="Andar, ala..." style={inp} />
      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
          Cancelar
        </button>
        <button
          onClick={async () => {
            const n = getField("localNome");
            if (!String(n || "").trim()) return;
            await createSessionLocal(n);
            setModal(null);
            showT("Local criado");
          }}
          style={{ ...bp, flex: 1 }}
        >
          Criar
        </button>
      </div>
    </Overlay>
  );
}
