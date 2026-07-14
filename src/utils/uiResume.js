const KEY = "inv-ui-resume";

export function buildItemSnapshot(item) {
  if (!item?.id) return null;
  return {
    id: item.id,
    patrimonioLabel: item.patrimonioLabel ?? null,
    data: item.data || "",
    especie: item.especie || "",
    descricao: item.descricao || "",
    marca: item.marca || "",
    fornecedor: item.fornecedor || "",
    empenho: item.empenho || "",
    nf: item.nf || "",
    dataNF: item.dataNF || "",
    tipoEntrada: item.tipoEntrada || "Próprio",
    valor: item.valor || 0,
    valorAtual: item.valorAtual || 0,
    isManual: !!item.isManual,
    unidadeId: item.unidadeId || "",
    unidadeNome: item.unidadeNome || "",
  };
}

export function buildFormSnapshot(formRef) {
  const f = formRef?.current || {};
  return {
    detEstado: f.detEstado || "Bom",
    detSituacao: f.detSituacao || "Em uso",
    detLocal: f.detLocal || "",
    detObs: f.detObs || "",
    detMarca: f.detMarca || "",
    detCor: f.detCor || "",
    detOrigem: f.detOrigem || "Próprio",
    detOrigemLocked: !!f.detOrigemLocked,
    detExistingUrls: Array.isArray(f.detExistingUrls) ? f.detExistingUrls : [],
    detDescricao: f.detDescricao || "",
    detEspecie: f.detEspecie || "",
    detPermutaDesc: f.detPermutaDesc || "",
    detPermutaMarca: f.detPermutaMarca || "",
    detPermutaEstado: f.detPermutaEstado || "Bom",
    // Formulário do item manual — sem isso, o recarregamento da página
    // durante a câmera nativa apagava tudo que o usuário digitou.
    manDesc: f.manDesc || "",
    manPatrimonio: f.manPatrimonio || "",
    manQtd: f.manQtd || 1,
    manSharePhotos: f.manSharePhotos !== false,
    manEspecie: f.manEspecie || "",
    manEspecieTouched: !!f.manEspecieTouched,
    manEspecieAuto: !!f.manEspecieAuto,
    manImei: f.manImei || "",
    manMarca: f.manMarca || "",
    manCor: f.manCor || "",
    manFornecedor: f.manFornecedor || "",
    manValor: f.manValor || "",
    manOrigem: f.manOrigem || "Próprio",
    manEstado: f.manEstado || "Bom",
    manSituacao: f.manSituacao || "Em uso",
    manLocal: f.manLocal || "",
    manDoacaoModo: f.manDoacaoModo || "uf",
    manDoacaoUf: f.manDoacaoUf || "MA",
    manDoacaoTexto: f.manDoacaoTexto || "",
  };
}

export function saveUiResume(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...data, ts: Date.now() }));
  } catch {}
}

export function loadUiResume() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || Date.now() - (data.ts || 0) > 30 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearUiResume() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
