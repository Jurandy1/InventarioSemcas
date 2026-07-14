/** Cores comuns de bens patrimoniais (móveis, equipamentos, etc.). */
export const CORES_ITEM = [
  { id: "preto", label: "Preto", hex: "#1f2937" },
  { id: "branco", label: "Branco", hex: "#f8fafc", border: "#cbd5e1" },
  { id: "cinza", label: "Cinza", hex: "#94a3b8" },
  { id: "prata", label: "Prata", hex: "#cbd5e1", border: "#64748b" },
  { id: "bege", label: "Bege", hex: "#e7d5b8", border: "#b45309" },
  { id: "marrom", label: "Marrom", hex: "#78350f" },
  { id: "madeira", label: "Madeira", hex: "#a16207" },
  { id: "azul", label: "Azul", hex: "#2563eb" },
  { id: "verde", label: "Verde", hex: "#16a34a" },
  { id: "vermelho", label: "Vermelho", hex: "#dc2626" },
  { id: "amarelo", label: "Amarelo", hex: "#eab308", border: "#a16207" },
  { id: "laranja", label: "Laranja", hex: "#ea580c" },
  { id: "rosa", label: "Rosa", hex: "#db2777" },
  { id: "roxo", label: "Roxo", hex: "#7c3aed" },
];

export function corItemById(id) {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return null;
  return CORES_ITEM.find((c) => c.id === key) || null;
}

export function labelCorItem(idOrLabel) {
  const known = corItemById(idOrLabel);
  if (known) return known.label;
  const raw = String(idOrLabel || "").trim();
  return raw || "";
}
