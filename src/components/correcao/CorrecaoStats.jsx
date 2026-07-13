import React from "react";

export function CorrecaoStats({ stats, onFiltro, filtroAtivo }) {
  const cards = [
    { id: "todos", label: "Inventariados", value: stats.total, hint: "Itens já inventariados" },
    { id: "precisa_padronizar", label: "Precisam padronizar", value: stats.precisaPadronizar, hint: "Grafia fora do padrão", warn: stats.precisaPadronizar > 0 },
    { id: "abreviacao", label: "Com abreviação", value: stats.comAbrev, hint: "c/, s/, p/ etc.", warn: stats.comAbrev > 0 },
    { id: "baixa_qualidade", label: "Baixa qualidade", value: stats.baixaQualidade, hint: "Nomes com vários problemas", warn: stats.baixaQualidade > 0 },
    { id: "sem_foto", label: "Sem foto", value: stats.semFoto, hint: "Itens inventariados sem foto — clique para adicionar", warn: stats.semFoto > 0 },
    { id: "corrigidos", label: "Já padronizados", value: stats.jaPadronizados, hint: "Nomes corrigidos", accent: true },
  ];

  return (
    <div className="correcao-stats" role="group" aria-label="Indicadores de padronização">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`correcao-stat${filtroAtivo === c.id || (c.id === "corrigidos" && filtroAtivo === "corrigidos-tab") ? " correcao-stat--active" : ""}${c.warn ? " correcao-stat--warn" : ""}${c.accent ? " correcao-stat--accent" : ""}`}
          onClick={() => onFiltro?.(c.id)}
          title={c.hint}
        >
          <span className="correcao-stat__value">{c.value}</span>
          <span className="correcao-stat__label">{c.label}</span>
        </button>
      ))}
    </div>
  );
}
