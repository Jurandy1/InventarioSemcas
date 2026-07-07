import React, { useMemo } from "react";
import { diffNomePalavras } from "../../utils/nomeCorrecao.js";

function DiffLine({ tokens }) {
  if (!tokens?.length) return <span className="correcao-diff__empty">—</span>;
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={`correcao-diff__tok correcao-diff__tok--${t.type}`}>
          {t.text}
          {i < tokens.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

export function NomeDiff({ antes, depois, compact }) {
  const diff = useMemo(() => diffNomePalavras(antes, depois), [antes, depois]);
  if (!antes && !depois) return null;
  const igual = normalize(antes) === normalize(depois);
  if (igual) {
    return (
      <div className={`correcao-diff${compact ? " correcao-diff--compact" : ""}`}>
        <div className="correcao-diff__row">
          <span className="correcao-diff__label">Nome</span>
          <span className="correcao-diff__text">{depois || antes}</span>
        </div>
        <p className="correcao-diff__ok">Nenhuma alteração necessária</p>
      </div>
    );
  }
  return (
    <div className={`correcao-diff${compact ? " correcao-diff--compact" : ""}`}>
      <div className="correcao-diff__row">
        <span className="correcao-diff__label">Antes</span>
        <span className="correcao-diff__text correcao-diff__text--antes">
          <DiffLine tokens={diff.antes} />
        </span>
      </div>
      <div className="correcao-diff__arrow" aria-hidden="true">↓</div>
      <div className="correcao-diff__row">
        <span className="correcao-diff__label">Depois</span>
        <span className="correcao-diff__text correcao-diff__text--depois">
          <DiffLine tokens={diff.depois} />
        </span>
      </div>
    </div>
  );
}

function normalize(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
