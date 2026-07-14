import React from "react";
import { TInput } from "../FormFields.jsx";
import { AtributoChips } from "./AtributoChips.jsx";
import { CorrecaoItemPhoto } from "./CorrecaoItemPhoto.jsx";
import { NomeDiff } from "./NomeDiff.jsx";
import { getItemMarca } from "../../utils/nomeCorrecao.js";

/** Lote de itens que serão padronizados para o mesmo nome final. */
export function PadronizacaoLoteCard({
  lote,
  foundMap,
  nomeFinal,
  onNomeChange,
  targets,
  onToggleMember,
  onAplicar,
  onSugerirIa,
  onViewImage,
  busy,
  iaBusy,
  geminiOk,
  bs,
  inp,
  expanded,
  onToggleExpand,
}) {
  const exemploAntes = lote.members[0]?.labelOriginal || "";

  return (
    <article className={`correcao-grupo${expanded ? " correcao-grupo--open" : ""}`}>
      <header className="correcao-grupo__head">
        <button type="button" className="correcao-grupo__toggle" onClick={onToggleExpand}>
          <span className="correcao-grupo__badge">{lote.members.length} itens → mesmo nome</span>
          <strong className="correcao-grupo__title">{nomeFinal || lote.nomePadronizado}</strong>
          <span className="correcao-grupo__meta">Padronização de grafia (não é duplicata)</span>
        </button>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {geminiOk && (
            <button
              type="button"
              className="gov-btn gov-btn--secondary"
              style={bs}
              disabled={busy || iaBusy}
              onClick={onSugerirIa}
              title="Sugerir nome olhando a foto"
            >
              {iaBusy ? "IA…" : "IA foto"}
            </button>
          )}
          <button
            type="button"
            className="gov-btn gov-btn--primary"
            style={bs}
            disabled={busy || !targets.length || !nomeFinal}
            onClick={onAplicar}
          >
            Padronizar {targets.length}
          </button>
        </div>
      </header>

      {expanded && (
        <div className="correcao-grupo__body">
          <div className="correcao-grupo__preview">
            <label className="correcao-label">Nome padronizado</label>
            <TInput
              key={`nome-${lote.key}`}
              initial={nomeFinal}
              onVal={onNomeChange}
              style={{ ...inp, width: "100%" }}
            />
            {exemploAntes && <NomeDiff antes={exemploAntes} depois={nomeFinal} compact />}
          </div>

          <ul className="correcao-grupo__members">
            {lote.members.map((m) => {
              const checked = targets.includes(m.id);
              return (
                <li key={m.id} className="correcao-grupo__member">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleMember(m.id)}
                    className="correcao-check"
                    aria-label={`Incluir ${m.labelOriginal}`}
                  />
                  <CorrecaoItemPhoto foundMap={foundMap} itemId={m.id} onViewImage={onViewImage} size={56} />
                  <div className="correcao-grupo__member-text">
                    <div className="correcao-grupo__member-label">{m.labelOriginal}</div>
                    <AtributoChips nome={m.labelOriginal} marca={m.marca || getItemMarca(m.item, foundMap)} />
                    <div className="correcao-grupo__member-sub">
                      {m.item?.unidadeNome || m.item?.unidadeId || ""} · {m.item?.id}
                    </div>
                    {m.labelOriginal !== nomeFinal && (
                      <NomeDiff antes={m.labelOriginal} depois={nomeFinal} compact />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}
