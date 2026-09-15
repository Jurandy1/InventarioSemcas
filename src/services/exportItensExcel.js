import { getFoundEntry, isItemInventariado } from "../utils/patrimonioId.js";
import { getCategoryGroup } from "../constants/categories.js";
import { getItemIdInterno, getTipoRegistroItem } from "../app/helpers/appHelpers.js";

export const ITEM_EXPORT_COLUMNS = [
  { key: "idInterno", label: "ID interno", group: "Identificação", width: 38 },
  { key: "tipoRegistro", label: "Tipo de registro", group: "Identificação", width: 18 },
  { key: "patrimonio", label: "Nº Patrimônio", group: "Identificação", width: 18 },
  { key: "idRegistro", label: "ID do registro", group: "Identificação", width: 28 },
  { key: "descricao", label: "Descrição", group: "Identificação", width: 42 },
  { key: "especie", label: "Espécie", group: "Identificação", width: 26 },
  { key: "categoria", label: "Categoria", group: "Identificação", width: 24 },
  { key: "marca", label: "Marca", group: "Identificação", width: 22 },
  { key: "imei", label: "IMEI / Nº de série", group: "Identificação", width: 22 },

  { key: "unidadeCadastrada", label: "Unidade cadastrada", group: "Localização", width: 42 },
  { key: "unidadeEncontrada", label: "Unidade encontrada", group: "Localização", width: 42 },
  { key: "local", label: "Local", group: "Localização", width: 28 },
  { key: "unidadeIdCadastrada", label: "ID da unidade cadastrada", group: "Localização", width: 22 },
  { key: "unidadeIdEncontrada", label: "ID da unidade encontrada", group: "Localização", width: 22 },
  { key: "localId", label: "ID do local", group: "Localização", width: 20 },

  { key: "statusInventario", label: "Status do inventário", group: "Inventário", width: 22 },
  { key: "estado", label: "Estado de conservação", group: "Inventário", width: 24 },
  { key: "situacao", label: "Situação", group: "Inventário", width: 22 },
  { key: "origem", label: "Origem", group: "Inventário", width: 22 },
  { key: "cor", label: "Cor", group: "Inventário", width: 18 },
  { key: "observacoes", label: "Observações", group: "Inventário", width: 42 },
  { key: "inventariadoPor", label: "Inventariado por", group: "Inventário", width: 28 },
  { key: "emailInventariante", label: "E-mail do inventariante", group: "Inventário", width: 30 },
  { key: "dataInventario", label: "Data do inventário", group: "Inventário", width: 20 },
  { key: "horaInventario", label: "Hora do inventário", group: "Inventário", width: 19 },
  { key: "ultimaAtualizacao", label: "Última atualização", group: "Inventário", width: 24 },
  { key: "quantidadeFotos", label: "Quantidade de fotos", group: "Inventário", width: 22, type: "number" },
  { key: "fotos", label: "Fotos (links)", group: "Inventário", width: 45 },
  { key: "inseridoManualmente", label: "Inserido manualmente", group: "Inventário", width: 22 },
  { key: "semTombo", label: "Sem tombo", group: "Inventário", width: 16 },
  { key: "tomboReferencia", label: "Tombo de referência", group: "Inventário", width: 22 },
  { key: "plaquetaAusente", label: "Plaqueta ausente", group: "Inventário", width: 20 },
  { key: "identificadoPorFoto", label: "Identificado por foto", group: "Inventário", width: 22 },

  { key: "fornecedor", label: "Fornecedor", group: "Aquisição", width: 30 },
  { key: "empenho", label: "Empenho", group: "Aquisição", width: 20 },
  { key: "notaFiscal", label: "Nota fiscal", group: "Aquisição", width: 20 },
  { key: "dataNotaFiscal", label: "Data da nota fiscal", group: "Aquisição", width: 20 },
  { key: "tipoEntrada", label: "Tipo de entrada", group: "Aquisição", width: 20 },
  { key: "dataPatrimonio", label: "Data do patrimônio", group: "Aquisição", width: 20 },
  { key: "valorAquisicao", label: "Valor de aquisição", group: "Aquisição", width: 20, type: "number" },
  { key: "valorAtual", label: "Valor atual", group: "Aquisição", width: 18, type: "number" },
  { key: "origemDoacao", label: "Origem da doação", group: "Aquisição", width: 30 },
  { key: "tipoOrigemDoacao", label: "Tipo da origem da doação", group: "Aquisição", width: 26 },

  { key: "permutaDescricao", label: "Descrição da permuta", group: "Permuta", width: 36 },
  { key: "permutaMarca", label: "Marca da permuta", group: "Permuta", width: 22 },
  { key: "permutaEstado", label: "Estado da permuta", group: "Permuta", width: 22 },
];

export const DEFAULT_ITEM_EXPORT_COLUMNS = [
  "idInterno",
  "tipoRegistro",
  "patrimonio",
  "descricao",
  "marca",
  "categoria",
  "unidadeCadastrada",
  "unidadeEncontrada",
  "local",
  "statusInventario",
  "estado",
];

/** Sempre vão no Excel, mesmo se o usuário desmarcar outras colunas. */
export const REQUIRED_ITEM_EXPORT_COLUMNS = ["idInterno", "tipoRegistro"];

function resolveExportColumns(columnKeys) {
  const requested = Array.isArray(columnKeys) ? columnKeys.filter(Boolean) : [];
  const orderedKeys = [
    ...REQUIRED_ITEM_EXPORT_COLUMNS,
    ...requested.filter((key) => !REQUIRED_ITEM_EXPORT_COLUMNS.includes(key)),
  ];
  return orderedKeys
    .map((key) => ITEM_EXPORT_COLUMNS.find((column) => column.key === key))
    .filter(Boolean);
}

function buildNameMap(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = row?.id ?? row?._id;
    if (id == null) continue;
    map.set(String(id), row?.nome || row?.name || String(id));
  }
  return map;
}

function valueFrom(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return "";
  const text = String(value).trim().replace(/\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : "";
}

function yesNo(value) {
  return value ? "Sim" : "Não";
}

export function buildItemExportRows({ itens = [], foundMap, foundSet, unidades = [], locais = [] }) {
  const unidadeNomeById = buildNameMap(unidades);
  const localNomeById = buildNameMap(locais);

  return itens.map((item, index) => {
    const found = getFoundEntry(item?.id, foundMap);
    const inventariado = Boolean(found) || isItemInventariado(item?.id, foundSet);
    const unidadeCadastradaId = valueFrom(item, "unidadeId");
    const unidadeEncontradaId = valueFrom(found, "unidadeId") || unidadeCadastradaId;
    const localId = valueFrom(found, "localId");
    const fotos = Array.isArray(found?.fotoUrls) ? found.fotoUrls.filter(Boolean) : [];

    const especie = valueFrom(found, "especieEdit") || valueFrom(item, "especie");

    const tipoRegistro = getTipoRegistroItem(item, found);
    const idInterno = getItemIdInterno(item, found);

    return {
      _selectionKey: `${String(item?.unidadeId || "sem-unidade")}_${String(item?.id || index)}_${index}`,
      idInterno: String(idInterno || ""),
      tipoRegistro,
      patrimonio: String(valueFrom(item, "patrimonioLabel", "id") || ""),
      idRegistro: String(valueFrom(item, "id") || valueFrom(found, "patrimonioId", "_id") || ""),
      descricao: valueFrom(found, "descricaoEdit") || valueFrom(item, "descricao", "especie"),
      especie,
      categoria: especie ? getCategoryGroup(especie) : "",
      marca: valueFrom(found, "marca") || valueFrom(item, "marca"),
      imei: valueFrom(found, "imei", "numeroSerie", "serial") || valueFrom(item, "imei", "numeroSerie", "serial"),

      unidadeCadastrada: unidadeNomeById.get(String(unidadeCadastradaId)) || valueFrom(item, "unidadeNome") || String(unidadeCadastradaId || ""),
      unidadeEncontrada: unidadeNomeById.get(String(unidadeEncontradaId)) || valueFrom(found, "unidadeNome") || valueFrom(item, "unidadeNome") || String(unidadeEncontradaId || ""),
      local: !localId || localId === "sem-local"
        ? "Sem local"
        : localNomeById.get(String(localId)) || valueFrom(found, "localNome") || String(localId),
      unidadeIdCadastrada: String(unidadeCadastradaId || ""),
      unidadeIdEncontrada: String(unidadeEncontradaId || ""),
      localId: String(localId || ""),

      statusInventario: inventariado ? "Inventariado" : "Pendente",
      estado: valueFrom(found, "estado"),
      situacao: valueFrom(found, "situacao"),
      origem: valueFrom(found, "origem"),
      cor: valueFrom(found, "cor") || valueFrom(item, "cor"),
      observacoes: valueFrom(found, "obs", "observacao", "observacoes"),
      inventariadoPor: valueFrom(found, "usuario", "usuarioNome", "inventariadoPor"),
      emailInventariante: valueFrom(found, "email", "usuarioEmail"),
      dataInventario: valueFrom(found, "data"),
      horaInventario: valueFrom(found, "hora"),
      ultimaAtualizacao: valueFrom(found, "ultimaAtualizacao", "updatedAt"),
      quantidadeFotos: fotos.length,
      fotos: fotos.join(" | "),
      inseridoManualmente: yesNo(tipoRegistro !== "Item encontrado"),
      semTombo: yesNo(Boolean(found?.semTombo || item?.semTombo)),
      tomboReferencia: String(valueFrom(found, "tomboReferencia") || valueFrom(item, "tomboRef", "tomboReferencia") || ""),
      plaquetaAusente: yesNo(Boolean(found?.plaquetaAusente)),
      identificadoPorFoto: yesNo(Boolean(found?.identificadoPorFoto)),

      fornecedor: valueFrom(item, "fornecedor"),
      empenho: valueFrom(item, "empenho"),
      notaFiscal: valueFrom(item, "nf", "notaFiscal"),
      dataNotaFiscal: valueFrom(item, "dataNF", "dataNotaFiscal"),
      tipoEntrada: valueFrom(item, "tipoEntrada"),
      dataPatrimonio: valueFrom(item, "data"),
      valorAquisicao: asNumber(valueFrom(item, "valor")),
      valorAtual: asNumber(valueFrom(item, "valorAtual")),
      origemDoacao: valueFrom(found, "doacaoOrigem", "origemDoacao"),
      tipoOrigemDoacao: valueFrom(found, "doacaoOrigemTipo", "tipoOrigemDoacao"),

      permutaDescricao: valueFrom(found, "permutaDesc", "permutaDescricao"),
      permutaMarca: valueFrom(found, "permutaMarca"),
      permutaEstado: valueFrom(found, "permutaEstado"),
    };
  });
}

function safeCellValue(value) {
  if (typeof value !== "string") return value;
  return /^[=+@]/.test(value) ? `'${value}` : value;
}

function createWorksheet(XLSX, rows, columns) {
  const data = [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => safeCellValue(row[column.key] ?? ""))),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = columns.map((column) => ({ wch: column.width || 18 }));
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, data.length - 1), c: columns.length - 1 } }) };
  worksheet["!rows"] = [{ hpt: 24 }];

  columns.forEach((column, columnIndex) => {
    if (column.type !== "number") return;
    for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (worksheet[address]?.t === "n") worksheet[address].z = "#,##0.00";
    }
  });
  return worksheet;
}

function safeSheetName(rawName, usedNames) {
  const base = String(rawName || "Sem categoria")
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Sem categoria";
  let name = base;
  let suffix = 2;
  while (usedNames.has(name.toLocaleLowerCase("pt-BR"))) {
    const tail = ` ${suffix}`;
    name = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  usedNames.add(name.toLocaleLowerCase("pt-BR"));
  return name;
}

export async function gerarPlanilhaItens({ rows, columnKeys, separarPorCategoria = false }) {
  const columns = resolveExportColumns(columnKeys);
  if (!rows?.length) throw new Error("Selecione pelo menos um item.");
  if (!columns.length) throw new Error("Selecione pelo menos uma coluna.");

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  if (separarPorCategoria) {
    const byCategory = new Map();
    for (const row of rows) {
      const category = row.categoria || "Sem categoria";
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(row);
    }
    const usedNames = new Set();
    [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .forEach(([category, categoryRows]) => {
        XLSX.utils.book_append_sheet(
          workbook,
          createWorksheet(XLSX, categoryRows, columns),
          safeSheetName(category, usedNames)
        );
      });
  } else {
    XLSX.utils.book_append_sheet(workbook, createWorksheet(XLSX, rows, columns), "Itens");
  }
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `itens_inventario_${stamp}.xlsx`, { compression: true });
}
