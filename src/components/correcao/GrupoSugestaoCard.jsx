import React from "react";
import { TInput } from "../FormFields.jsx";
import { AtributoChips } from "./AtributoChips.jsx";
import { CorrecaoItemPhoto } from "./CorrecaoItemPhoto.jsx";
import { NomeDiff } from "./NomeDiff.jsx";
import { getItemMarca } from "../../utils/nomeCorrecao.js";

export function GrupoSugestaoCard({
  grupo,
  foundMap,
  nomeFinal,
  onNomeChange,
  targets,
  totalAplicar,
  onToggleMember,
  onAplicar,
  onViewImage,
  busy,
  bs,
  inp,
  expanded,
  onToggleExpand,
}) {
  const refMember = grupo.members.find((m) => m.isReference);
  const avgScore = Math.round(
    (grupo.members.filter((m) => !m.isReference).reduce((s, m) => s + (m.score || 0), 0) /
      Math.max(1, grupo.members.length - 1)) *
      100
  );

  return (
    <article className={`correcao-grupo${expanded ? " correcao-grupo--open" : ""}`}>
      <header className="correcao-grupo__head">
        <button type="button" className="correcao-grupo__toggle" onClick={onToggleExpand}>
          <span className="correcao-grupo__badge">{grupo.members.length} itens</span>
          <strong className="correcao-grupo__title">{grupo.referenceLabel}</strong>
          <span className="correcao-grupo__meta">Similaridade média {avgScore}%</span>
        </button>
        <button
          type="button"
          className="gov-btn gov-btn--primary"
          style={bs}
          disabled={busy || !totalAplicar || !nomeFinal}
          onClick={onAplicar}
        >
          Padronizar {totalAplicar}
        </button>
      </header>

      {expanded && (
        <div className="correcao-grupo__body">
          <div className="correcao-grupo__preview">
            <label className="correcao-label">Nome padronizado sugerido</label>
            <TInput
              key={`nome-${grupo.key}`}
              initial={nomeFinal}
              onVal={onNomeChange}
              style={{ ...inp, width: "100%" }}
            />
            <NomeDiff antes={grupo.referenceLabel} depois={nomeFinal} compact />
          </div>

          <ul className="correcao-grupo__members">
            {grupo.members.map((m) => {
              const isRef = m.isReference;
              const checked = isRef || targets.includes(m.id);
              return (
                <li
                  key={m.id}
                  className={`correcao-grupo__member${isRef ? " correcao-grupo__member--ref" : ""}`}
                >
                  {!isRef ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleMember(m.id)}
                      className="correcao-check"
                      aria-label={`Incluir ${m.label}`}
                    />
                  ) : (
                    <span className="correcao-grupo__star" aria-hidden="true">★</span>
                  )}
                  <CorrecaoItemPhoto foundMap={foundMap} itemId={m.id} onViewImage={onViewImage} size={56} />
                  <div className="correcao-grupo__member-text">
                    <div className="correcao-grupo__member-label">{m.label}</div>
                    <AtributoChips nome={m.label} marca={m.marca || getItemMarca(m.item, foundMap)} />
                    <div className="correcao-grupo__member-sub">
                      {m.item?.unidadeNome || m.item?.unidadeId || ""}
                      {!isRef && <> · {Math.round((m.score || 0) * 100)}% similar</>}
                    </div>
                  </div>
                  {isRef && <span className="correcao-grupo__ref-tag">PADRÃO</span>}
                  {!isRef && nomeFinal && nomeFinal !== m.label && (
                    <NomeDiff antes={m.label} depois={nomeFinal} compact />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}
