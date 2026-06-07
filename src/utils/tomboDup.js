function normLabel(item) {
  return String(item?.patrimonioLabel || item?.id || "").trim();
}

export function detectTombosDuplicados(todosItens, foundList) {
  const dups = [];
  const itemById = new Map();
  for (const item of todosItens || []) {
    itemById.set(item.id, item);
  }

  for (const f of foundList || []) {
    const item = itemById.get(f.patrimonioId);
    if (!item?.unidadeId || !f.unidadeId) continue;
    if (item.unidadeId === f.unidadeId) continue;
    dups.push({
      id: item.id,
      descricao: item.descricao || item.especie || "—",
      especie: item.especie || "",
      unidadeOrigem: item.unidadeNome || item.unidadeId,
      unidadeEncontrada: f.unidadeNome || f.unidadeId,
      tipo: "unidade_errada",
    });
  }

  const byLabel = new Map();
  for (const item of todosItens || []) {
    const label = normLabel(item);
    if (!label || label.toUpperCase() === "S/T") continue;
    const key = label.toLowerCase();
    if (!byLabel.has(key)) byLabel.set(key, []);
    byLabel.get(key).push(item);
  }

  for (const [, items] of byLabel) {
    if (items.length < 2) continue;
    const units = [...new Set(items.map((i) => i.unidadeNome || i.unidadeId))];
    if (units.length < 2) continue;
    dups.push({
      id: items.map((i) => i.id).join(", "),
      descricao: items[0].descricao || items[0].especie || labelFrom(items[0]),
      especie: items[0].especie || "",
      unidadeOrigem: units.join(" · "),
      unidadeEncontrada: "Mesmo tombo em unidades diferentes",
      tipo: "label_dup",
    });
  }

  return dups;
}

function labelFrom(item) {
  return normLabel(item) || "—";
}
