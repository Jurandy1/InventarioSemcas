export const CATEGORY_TREE = [
  {
    name: "Cadeiras",
    icon: "🪑",
    re: /CADEIRA|POLTRONA|LONGARINA|ASSENTO/,
    subs: [
      { label: "Cadeira Giratória", match: (e) => /GIRAT|SECRETÁRI/.test(e) },
      { label: "Cadeira Plástica", match: (e) => /PLÁST|PLASTIC/.test(e) },
      { label: "Cadeira Presidente", match: (e) => /PRESIDENT/.test(e) },
      { label: "Longarina", match: (e) => /LONGARINA/.test(e) },
      { label: "Conjunto c/ Mesa", match: (e) => /CONJUNTO/.test(e) },
      { label: "Cadeira de Rodas", match: (e) => /RODAS/.test(e) },
      { label: "Cadeira Fixa / Geral", match: () => true },
    ],
  },
  {
    name: "Mesas",
    icon: "🪞",
    re: /^MESA|BANCADA|BALCÃO/,
    subs: [
      { label: "Mesa de Trabalho", match: (e) => /TRABALHO|EM L|ESCRITÓRIO|ESCRITORIO/.test(e) || /^MESA$/.test(e) },
      { label: "Mesa Plástica", match: (e) => /PLÁST|PLASTIC/.test(e) },
      { label: "Mesa p/ Computador", match: (e) => /COMPUTADOR/.test(e) },
      { label: "Mesa p/ Impressora", match: (e) => /IMPRESSORA/.test(e) },
      { label: "Mesa de Reunião", match: (e) => /REUNI|CIRCULAR|RETANGUL/.test(e) },
      { label: "Outras Mesas", match: () => true },
    ],
  },
  {
    name: "Armários",
    icon: "🗄️",
    re: /ARMÁRI|ARMARIO|ARQUIVO|ESTANTE|GAVETEIRO|RACK|PRATELEIRA|ROUPEIRO/,
    subs: [
      { label: "Arquivo", match: (e) => /ARQUIVO/.test(e) },
      { label: "Armário em Aço", match: (e) => /(ARMÁRI|ARMARIO)/.test(e) && /AÇO|ACO/.test(e) },
      { label: "Armário em MDF/Madeira", match: (e) => /ARMÁRI|ARMARIO/.test(e) },
      { label: "Estante em Aço", match: (e) => /ESTANTE/.test(e) && /AÇO|ACO/.test(e) },
      { label: "Estante", match: (e) => /ESTANTE/.test(e) },
      { label: "Gaveteiro", match: (e) => /GAVETEIRO/.test(e) },
      { label: "Rack / Suporte", match: () => true },
    ],
  },
  {
    name: "Informática",
    icon: "💻",
    re: /NOTEBOOK|COMPUTADOR|MICROCOMPUTADOR|CPU|LAPTOP|TABLET|DESKTOP|SCANNER|IMPRESSORA|MULTIFUNCIONAL|MONITOR|FRAGMENTADORA|ESTAÇÃO DE TRABALHO|MICRO COMPUTADOR/,
    subs: [
      { label: "Notebook / Laptop", match: (e) => /NOTEBOOK|LAPTOP/.test(e) },
      { label: "Tablet", match: (e) => /TABLET/.test(e) },
      { label: "Computador (Desktop)", match: (e) => /COMPUTADOR|MICROCOMPUTADOR|CPU|DESKTOP|ESTAÇÃO|MICRO COMPUTADOR/.test(e) },
      { label: "Monitor", match: (e) => /MONITOR/.test(e) },
      { label: "Impressora", match: (e) => /IMPRESSORA|MULTIFUNCIONAL/.test(e) },
      { label: "Scanner", match: (e) => /SCANNER/.test(e) },
      { label: "Fragmentadora", match: (e) => /FRAGMENTADORA/.test(e) },
      { label: "Acessórios", match: () => true },
    ],
  },
  {
    name: "TV / AV",
    icon: "📺",
    re: /TELEVISOR|TV |PROJETOR|TELÃO|DISPLAY|TELA|DATA SHOW/,
    subs: [
      { label: "Televisor", match: (e) => /TELEVISOR|^TV /.test(e) },
      { label: "Projetor", match: (e) => /PROJETOR|DATA SHOW/.test(e) },
      { label: "Tela de Projeção", match: (e) => /TELA/.test(e) },
      { label: "Outros", match: () => true },
    ],
  },
  {
    name: "Climatização",
    icon: "❄️",
    re: /AR CONDICIONADO|VENTILADOR|CLIMATIZADOR|EXAUSTOR|SPLIT|PURIFICADOR/,
    subs: [
      { label: "Ar-Condicionado", match: (e) => /AR CONDICIONADO|SPLIT/.test(e) },
      { label: "Ventilador de Parede", match: (e) => /VENTILADOR/.test(e) && /PAREDE/.test(e) },
      { label: "Ventilador de Coluna", match: (e) => /VENTILADOR/.test(e) && /COLUNA/.test(e) },
      { label: "Ventilador Geral", match: (e) => /VENTILADOR|CLIMATIZADOR|EXAUSTOR/.test(e) },
      { label: "Purificador", match: () => true },
    ],
  },
  {
    name: "Rede / TI",
    icon: "🔌",
    re: /CÂMERA|CAMERA|ROTEADOR|SWITCH|NOBREAK|ESTABILIZADOR|SERVIDOR|HUB|MICROFONE|CAIXA AMPLIF|DVR|KIT DE SEGUR|MINI SYSTEM/,
    subs: [
      { label: "Câmera de Segurança", match: (e) => /CÂMERA|CAMERA|DVR|KIT DE SEGUR/.test(e) },
      { label: "Switch / Roteador", match: (e) => /SWITCH|ROTEADOR|HUB|SERVIDOR/.test(e) },
      { label: "Nobreak", match: (e) => /NOBREAK/.test(e) },
      { label: "Estabilizador", match: (e) => /ESTABILIZADOR/.test(e) },
      { label: "Caixa de Som / Microfone", match: () => true },
    ],
  },
  {
    name: "Cozinha",
    icon: "🍳",
    re: /LIQUIDIFICADOR|GELADEIRA|FOGÃO|MICROONDAS|CAFETEIRA|BEBEDOURO|FREEZER|FORNO|FILTRO|REFRIGERADOR|FOGAO|FRIGOBAR|BATEDEIRA|MAQUINA DE LAVAR/,
    subs: [
      { label: "Bebedouro", match: (e) => /BEBEDOURO/.test(e) },
      { label: "Geladeira / Refrigerador", match: (e) => /GELADEIRA|REFRIGERADOR|FRIGOBAR|FREEZER/.test(e) },
      { label: "Fogão", match: (e) => /FOGÃO|FOGAO/.test(e) },
      { label: "Liquidificador", match: (e) => /LIQUIDIFICADOR/.test(e) },
      { label: "Eletrodomésticos Diversos", match: () => true },
    ],
  },
  {
    name: "Saúde / Repouso",
    icon: "🏥",
    re: /\bCAMA\b|MACA|COLCHÃO|BERÇO|BERCE/,
    subs: [
      { label: "Cama / Colchão", match: (e) => /CAMA|COLCHÃO/.test(e) },
      { label: "Berço", match: (e) => /BERÇO|BERCE/.test(e) },
      { label: "Maca", match: () => true },
    ],
  },
  {
    name: "Outros",
    icon: "📦",
    re: null,
    subs: [
      { label: "Veículos", match: (e) => /AUTOMÓVEL|MICROÔNIBUS|ÔNIBUS|CAMINHÃO/.test(e) },
      { label: "Mobiliário Diverso", match: (e) => /SOFÁ|SOFA|ESCRIVANINHA|CONJUNTO REFEIT/.test(e) },
      { label: "Sinalização / Expo", match: (e) => /QUADRO|CAVALETE|MURAL|BANNER/.test(e) },
      { label: "Relógio de Ponto", match: (e) => /RELÓGIO/.test(e) },
      { label: "Equipamentos Diversos", match: () => true },
    ],
  },
];

export function getCategoryGroup(especie) {
  const e = String(especie || "").toUpperCase();
  for (const c of CATEGORY_TREE) {
    if (c.re && c.re.test(e)) return c.name;
  }
  return "Outros";
}

export function getSubcategoryLabel(especie, catName) {
  const e = String(especie || "").toUpperCase();
  const cat = CATEGORY_TREE.find((c) => c.name === catName);
  if (!cat) return null;
  for (const s of cat.subs || []) {
    if (s.match(e)) return s.label;
  }
  return null;
}
