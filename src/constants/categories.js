/**
 * Árvore de categorias alinhada ao inventário categorizada (planilha SEMCAS).
 * Preferir categoria/subcategoria gravadas no inventário (extras); regex é fallback.
 */
export const CATEGORY_TREE = [
  {
    name: "Mobiliário - Assentos",
    icon: "",
    re: /CADEIRA|POLTRONA|LONGARINA|ASSENTO/,
    subs: [
      { label: "Cadeira plástica (monobloco)", match: (e) => /PLÁST|PLASTIC|MONOBLOCO/.test(e) },
      { label: "Cadeira em polipropileno (sem detalhamento)", match: (e) => /POLIPROPILENO/.test(e) && !/FIXA|ISO|GIRAT/.test(e) },
      { label: "Cadeira fixa em polipropileno (tipo ISO)", match: (e) => /ISO|POLIPROPILENO/.test(e) && /FIXA/.test(e) },
      { label: "Cadeira giratória", match: (e) => /GIRAT|SECRETÁRI|SECRETARI/.test(e) },
      { label: "Longarina 5 lugares", match: (e) => /LONGARINA/.test(e) && /5/.test(e) },
      { label: "Longarina 3 lugares", match: (e) => /LONGARINA/.test(e) && /3/.test(e) },
      { label: "Longarina", match: (e) => /LONGARINA/.test(e) },
      { label: "Cadeira fixa estofada", match: (e) => /ESTOFAD/.test(e) },
      { label: "Cadeira infantil", match: (e) => /INFANTIL/.test(e) },
      { label: "Cadeira fixa tipo palito", match: (e) => /PALITO/.test(e) },
      { label: "Cadeira presidente / executiva", match: (e) => /PRESIDENT|EXECUTIV/.test(e) },
      { label: "Cadeira universitária com prancheta", match: (e) => /UNIVERSIT|PRANCHETA/.test(e) },
      { label: "Cadeira de madeira / palhinha", match: (e) => /MADEIRA|PALHINHA/.test(e) },
      { label: "Cadeira fixa", match: (e) => /FIXA/.test(e) },
      { label: "Cadeira (tipo não especificado)", match: () => true },
    ],
  },
  {
    name: "Mobiliário - Mesas e Superfícies",
    icon: "",
    re: /^MESA|BANCADA|BALCÃO|BALCAO|GUICH|ESCRIVANINHA|CONJUNTO DE MESA/,
    subs: [
      { label: "Mesa de escritório", match: (e) => /ESCRITÓRIO|ESCRITORIO|TRABALHO/.test(e) },
      { label: "Mesa plástica", match: (e) => /PLÁST|PLASTIC/.test(e) },
      { label: "Mesa para computador / digitador", match: (e) => /COMPUTADOR|DIGITADOR/.test(e) },
      { label: "Mesa em L", match: (e) => /\bEM L\b|\bL\b/.test(e) },
      { label: "Mesa de apoio", match: (e) => /APOIO/.test(e) },
      { label: "Mesa infantil", match: (e) => /INFANTIL/.test(e) },
      { label: "Mesa redonda", match: (e) => /REDOND|CIRCULAR/.test(e) },
      { label: "Mesa de reunião", match: (e) => /REUNI/.test(e) },
      { label: "Conjunto de mesa com cadeiras", match: (e) => /CONJUNTO/.test(e) },
      { label: "Mesa de refeitório / copa", match: (e) => /REFEIT|COPA/.test(e) },
      { label: "Guichê de atendimento", match: (e) => /GUICH/.test(e) },
      { label: "Mesa (tipo não especificado)", match: () => true },
    ],
  },
  {
    name: "Mobiliário - Guarda e Armazenamento",
    icon: "",
    re: /ARMÁRI|ARMARIO|ARQUIVO|ESTANTE|GAVETEIRO|RACK|PRATELEIRA|ROUPEIRO|CÔMODA|COMODA/,
    subs: [
      { label: "Armário de aço", match: (e) => /(ARMÁRI|ARMARIO)/.test(e) && /AÇO|ACO/.test(e) },
      { label: "Estante de aço dupla face", match: (e) => /ESTANTE/.test(e) && /DUPLA/.test(e) },
      { label: "Estante de aço", match: (e) => /ESTANTE/.test(e) && /AÇO|ACO/.test(e) },
      { label: "Arquivo de aço com gavetas", match: (e) => /ARQUIVO/.test(e) },
      { label: "Armário de MDF / madeira", match: (e) => /(ARMÁRI|ARMARIO)/.test(e) && /MDF|MADEIRA/.test(e) },
      { label: "Gaveteiro", match: (e) => /GAVETEIRO/.test(e) },
      { label: "Cômoda", match: (e) => /CÔMODA|COMODA/.test(e) },
      { label: "Móvel auxiliar / volante", match: (e) => /VOLANTE|AUXILIAR/.test(e) },
      { label: "Armário (material não informado)", match: () => true },
    ],
  },
  {
    name: "Climatização e Ventilação",
    icon: "",
    re: /AR CONDICIONADO|VENTILADOR|CLIMATIZADOR|EXAUSTOR|SPLIT|PURIFICADOR DE AR/,
    subs: [
      { label: "Ar-condicionado split", match: (e) => /AR CONDICIONADO|SPLIT/.test(e) },
      { label: "Ventilador de parede", match: (e) => /VENTILADOR/.test(e) && /PAREDE/.test(e) },
      { label: "Ventilador de coluna", match: (e) => /VENTILADOR/.test(e) && /COLUNA/.test(e) },
      { label: "Ventilador de pé", match: (e) => /VENTILADOR/.test(e) && /P[ÉE]\b/.test(e) },
      { label: "Ventilador (tipo não especificado)", match: (e) => /VENTILADOR|CLIMATIZADOR|EXAUSTOR/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Copa, Cozinha e Refeitório",
    icon: "",
    re: /LIQUIDIFICADOR|GELADEIRA|FOGÃO|FOGAO|MICROONDAS|CAFETEIRA|BEBEDOURO|FREEZER|FORNO|FILTRO|REFRIGERADOR|FRIGOBAR|BATEDEIRA|MAQUINA DE LAVAR|PURIFICADOR/,
    subs: [
      { label: "Refrigerador / geladeira", match: (e) => /GELADEIRA|REFRIGERADOR/.test(e) },
      { label: "Freezer / frigobar", match: (e) => /FREEZER|FRIGOBAR/.test(e) },
      { label: "Bebedouro", match: (e) => /BEBEDOURO/.test(e) },
      { label: "Purificador de água", match: (e) => /PURIFICADOR/.test(e) },
      { label: "Fogão industrial", match: (e) => /(FOGÃO|FOGAO)/.test(e) && /INDUSTRIAL/.test(e) },
      { label: "Fogão doméstico", match: (e) => /FOGÃO|FOGAO/.test(e) },
      { label: "Eletrodomésticos Diversos", match: () => true },
    ],
  },
  {
    name: "Equipamentos de Informática",
    icon: "",
    re: /NOTEBOOK|COMPUTADOR|MICROCOMPUTADOR|CPU|LAPTOP|TABLET|DESKTOP|SCANNER|IMPRESSORA|MULTIFUNCIONAL|MONITOR|FRAGMENTADORA|ESTAÇÃO DE TRABALHO|MICRO COMPUTADOR|PRODESK/,
    subs: [
      { label: "Notebook", match: (e) => /NOTEBOOK|LAPTOP/.test(e) },
      { label: "Tablet", match: (e) => /TABLET/.test(e) },
      { label: "Computador desktop (CPU)", match: (e) => /COMPUTADOR|MICROCOMPUTADOR|CPU|DESKTOP|PRODESK|ESTAÇÃO|MICRO COMPUTADOR/.test(e) },
      { label: "Monitor de vídeo", match: (e) => /MONITOR/.test(e) },
      { label: "Impressora / multifuncional", match: (e) => /IMPRESSORA|MULTIFUNCIONAL/.test(e) },
      { label: "Acessório / suporte", match: () => true },
    ],
  },
  {
    name: "Redes e Energia (TI)",
    icon: "",
    re: /ROTEADOR|SWITCH|NOBREAK|ESTABILIZADOR|SERVIDOR|HUB|MODEM|RACK DE REDE/,
    subs: [
      { label: "Estabilizador", match: (e) => /ESTABILIZADOR/.test(e) },
      { label: "Switch / hub de rede", match: (e) => /SWITCH|HUB/.test(e) },
      { label: "Roteador / modem", match: (e) => /ROTEADOR|MODEM/.test(e) },
      { label: "Rack de rede", match: (e) => /RACK/.test(e) },
      { label: "Nobreak", match: (e) => /NOBREAK/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Áudio, Vídeo e Projeção",
    icon: "",
    re: /TELEVISOR|TV |PROJETOR|TELÃO|TELAO|DISPLAY|TELA|DATA SHOW|CAIXA DE SOM|AMPLIF|SMART TV/,
    subs: [
      { label: "Televisor / Smart TV", match: (e) => /TELEVISOR|SMART TV|^TV /.test(e) },
      { label: "Projetor multimídia", match: (e) => /PROJETOR|DATA SHOW/.test(e) },
      { label: "Tela de projeção", match: (e) => /TELA/.test(e) },
      { label: "Caixa de som amplificada", match: (e) => /CAIXA|AMPLIF|SOM/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Apoio Pedagógico e Escritório",
    icon: "",
    re: /QUADRO|CAVALETE|FLIP|MURAL|CORTIÇA|CORTICA|BANNER/,
    subs: [
      { label: "Quadro branco", match: (e) => /QUADRO/.test(e) },
      { label: "Cavalete / flip chart", match: (e) => /CAVALETE|FLIP/.test(e) },
      { label: "Mural de cortiça", match: (e) => /MURAL|CORTIÇA|CORTICA/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Equipamentos Administrativos",
    icon: "",
    re: /RELÓGIO|RELOGIO|PONTO ELETR|TELEFONE|TELEFÔNICO|TELEFONICO/,
    subs: [
      { label: "Relógio de ponto", match: (e) => /RELÓGIO|RELOGIO|PONTO/.test(e) },
      { label: "Aparelho telefônico", match: (e) => /TELEFONE|TELEFÔNICO|TELEFONICO/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Segurança e Monitoramento",
    icon: "",
    re: /CÂMERA|CAMERA|CFTV|DVR|KIT DE SEGUR/,
    subs: [
      { label: "Câmera de CFTV (bullet)", match: (e) => /CÂMERA|CAMERA|CFTV|BULLET/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Veículos",
    icon: "",
    re: /AUTOMÓVEL|AUTOMOVEL|MICROÔNIBUS|MICROONIBUS|ÔNIBUS|ONIBUS|CAMINHÃO|CAMINHAO|VEÍCULO|VEICULO/,
    subs: [
      { label: "Veículo automotor", match: () => true },
    ],
  },
  {
    name: "Outros",
    icon: "",
    re: null,
    subs: [{ label: "Equipamentos Diversos", match: () => true }],
  },
];

function textForMatch(especieOrDesc) {
  return String(especieOrDesc || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function getCategoryGroup(especie) {
  const e = textForMatch(especie);
  for (const c of CATEGORY_TREE) {
    if (c.re && c.re.test(e)) return c.name;
  }
  return "Outros";
}

export function getSubcategoryLabel(especie, catName) {
  const e = textForMatch(especie);
  const cat = CATEGORY_TREE.find((c) => c.name === catName);
  if (!cat) return null;
  for (const s of cat.subs || []) {
    if (s.match(e)) return s.label;
  }
  return null;
}

/** Preferência: categoria gravada no inventário → fallback por espécie/descrição. */
export function getItemCategory(item, foundEntry) {
  const stored =
    foundEntry?.categoria ||
    item?.categoria ||
    foundEntry?.extras?.categoria ||
    item?.extras?.categoria ||
    "";
  if (stored && CATEGORY_TREE.some((c) => c.name === stored)) return stored;

  const text =
    foundEntry?.especieEdit ||
    item?.especie ||
    foundEntry?.descricaoEdit ||
    item?.descricao ||
    "";
  return getCategoryGroup(text);
}

/** Preferência: subcategoria gravada → fallback por regex na árvore. */
export function getItemSubcategory(item, foundEntry, catName) {
  const stored =
    foundEntry?.subcategoria ||
    item?.subcategoria ||
    foundEntry?.extras?.subcategoria ||
    item?.extras?.subcategoria ||
    "";
  const cat = catName || getItemCategory(item, foundEntry);
  if (stored) {
    const def = CATEGORY_TREE.find((c) => c.name === cat);
    if (def?.subs?.some((s) => s.label === stored)) return stored;
    if (stored) return stored;
  }
  const text =
    foundEntry?.especieEdit ||
    item?.especie ||
    foundEntry?.descricaoEdit ||
    item?.descricao ||
    "";
  return getSubcategoryLabel(text, cat) || "Outros";
}
