import React from "react";
import { describeNomeAtributos } from "../../utils/nomeCorrecao.js";

const COR_HEX = {
  preto: "#0f172a", branco: "#e2e8f0", azul: "#2563eb", vermelho: "#dc2626",
  verde: "#16a34a", amarelo: "#eab308", cinza: "#6b7280", chumbo: "#4b5563",
  grafite: "#374151", marrom: "#92400e", bege: "#d6c9a8", rosa: "#ec4899",
  roxo: "#7c3aed", lilas: "#c084fc", laranja: "#ea580c", vinho: "#7f1d1d",
  creme: "#f5f0dc", dourado: "#ca8a04", prata: "#9ca3af", prateado: "#9ca3af",
  cromado: "#cbd5e1", turquesa: "#06b6d4", salmao: "#fa8072", fume: "#64748b",
};

export function AtributoChips({ nome, marca }) {
  const chips = describeNomeAtributos(nome);
  if (!chips.length && !marca) return null;
  return (
    <div className="correcao-chips">
      {marca && <span className="correcao-chip correcao-chip--marca">{marca}</span>}
      {chips.map((c, i) => {
        if (c.tipo === "cor") {
          return (
            <span key={i} className="correcao-chip correcao-chip--cor">
              <span className="correcao-chip__swatch" style={{ background: COR_HEX[c.texto] || "#94a3b8" }} />
              {c.texto}
            </span>
          );
        }
        return (
          <span key={i} className="correcao-chip">
            {c.texto}
          </span>
        );
      })}
    </div>
  );
}
