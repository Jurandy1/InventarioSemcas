export const ESTADOS = ["Novo", "Ótimo", "Bom", "Regular", "Ruim", "Inservível"];
export const SITUACOES = ["Em uso", "Depósito", "Extraviado", "Avariado", "Baixado", "Permuta"];

export const EC = {
  Novo: { bg: "#E3F5E8", tx: "#0D4419", border: "#A8DAB5" },
  Ótimo: { bg: "#E3F5E8", tx: "#168821", border: "#A8DAB5" },
  Bom: { bg: "#E8F0FE", tx: "#1351B4", border: "#B8D4F0" },
  Regular: { bg: "#FFF8E6", tx: "#735C00", border: "#FFE08A" },
  Ruim: { bg: "#FDE8E8", tx: "#8A0015", border: "#F5C2C7" },
  Inservível: { bg: "#F0F2F5", tx: "#555555", border: "#CCCCCC" },
};

export const SC = {
  "Em uso": { bg: "#E3F5E8", tx: "#168821", border: "#A8DAB5" },
  Depósito: { bg: "#F0F2F5", tx: "#555555", border: "#CCCCCC" },
  Extraviado: { bg: "#FDE8E8", tx: "#8A0015", border: "#F5C2C7" },
  Avariado: { bg: "#FFF8E6", tx: "#735C00", border: "#FFE08A" },
  Baixado: { bg: "#F0F2F5", tx: "#555555", border: "#CCCCCC" },
  Permuta: { bg: "#FFF8E6", tx: "#735C00", border: "#FFE08A" },
};

export const PER_PAGE = 20;

/** UFs para origem de doação (manual / sem tombo). */
export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

