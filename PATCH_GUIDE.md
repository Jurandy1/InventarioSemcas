# PATCH — Inventário SEMCAS v2.1
# Arquitetura: XLSX estático → IndexedDB → Firebase Storage (fotos) → Firestore (resultados)

## RESPOSTA RÁPIDA: A PLANILHA
Sim. O arquivo `patrimonio_por_unidade.xlsx` fica na pasta `public/` do projeto.
O Vite serve como arquivo estático. O app baixa UMA VEZ e salva no IndexedDB.
NÃO precisa de upload toda vez. O botão 🔄 no header força atualização manual.

---

## ARQUIVOS DESTA ATUALIZAÇÃO

### NOVOS (criar do zero)
| Arquivo                    | O que faz                                          |
|---------------------------|----------------------------------------------------|
| src/utils/db.js           | Helper IndexedDB (cache local do XLSX)             |
| src/services/storage.js   | Upload de fotos para Firebase Storage via REST     |

### SUBSTITUIR (apagar o antigo, colar o novo)
| Arquivo                    | O que mudou                                        |
|---------------------------|----------------------------------------------------|
| src/utils/xlsx.js         | Mapeamento correto de colunas + normaliza tipoEntrada |
| src/app/App.jsx           | NF tab profissional + origem pré-preenchida        |
| .github/workflows/pages.yml | Sem Cloudinary (usa Firebase Storage)            |

### DELETAR
| Arquivo                    | Motivo                                             |
|---------------------------|----------------------------------------------------|
| src/services/cloudinary.js | Substituído por storage.js                        |

### ADICIONAR NO REPOSITÓRIO
```
public/
  patrimonio_por_unidade.xlsx   ← copiar a planilha aqui
```

---

## MAPEAMENTO DE COLUNAS DO XLSX (importante para o AI)

| Índice | Nome no cabeçalho    | Campo no objeto   |
|--------|---------------------|-------------------|
| 0      | Patrimônio          | id                |
| 1      | Data                | data              |
| 2      | Espécie             | especie           |
| 3      | Descrição           | descricao         |
| 4      | Marca               | marca             |
| 5      | Fornecedor          | fornecedor        |
| 6      | Empenho             | empenho           |
| 7      | N.F.                | nf                |
| 8      | Data N.F.           | dataNF            |
| 9      | Tombamento          | (ignorado)        |
| 10     | Situação            | (ignorado)        |
| 11     | Data Baixa          | (ignorado)        |
| 12     | Valor NF/Reavaliado | valor             |
| 13     | Valor Atual         | valorAtual        |
| 14     | Natureza            | (ignorado)        |
| 15     | Tipo de Entrada     | tipoEntrada       |

ATENÇÃO: col12 às vezes tem dois valores colados ("5.270,00 3.451,85").
O parseVal() extrai apenas o PRIMEIRO número.

---

## LÓGICA DO TIPO DE ENTRADA (CRÍTICO)

Valores possíveis no XLSX → normalização:
  "INCORPORADO" → tipoEntrada = "Incorporado"   (1.462 itens)
  "DOAÇÃO"      → tipoEntrada = "Doação"         (1.001 itens)
  ""  (vazio)   → tipoEntrada = "Próprio"         (4.239 itens)

### Comportamento no modal de detalhe:
- XLSX item (isManual = undefined/false):
  → detOrigem pré-preenchido com item.tipoEntrada
  → detOrigemLocked = true
  → Mostra badge colorido NÃO editável
  → Ícones: 🏛️ Próprio | 🎁 Doação | 📋 Incorporado

- Item manual (isManual = true):
  → detOrigemLocked = false
  → Mostra botões editáveis: Próprio | Doação | Permuta

### Cores dos badges de tipo:
  Próprio     → bg:#dbeafe  tx:#1d4ed8  (azul)
  Doação      → bg:#fef3c7  tx:#92400e  (âmbar)
  Incorporado → bg:#d1fae5  tx:#065f46  (verde)

---

## ABA NOTAS FISCAIS (v2.1 — profissional)

### Fonte dos dados
USA todosItens (todos os itens de TODAS as unidades), não só da unidade ativa.
Agrupa por número da NF → nfDataMap.

### Estrutura de cada nota:
```javascript
{
  nf            : "374",
  dataNF        : "25/03/2025",
  fornecedor    : "T AMORIM COMERCIO E SERVICOS LTDA",
  tipoEntrada   : "Próprio",
  itens         : [...],          // array de itens desta NF
  valorTotal    : 137200.00,      // soma de item.valor
  valorAtualTotal: 123450.00,     // soma de item.valorAtual
}
```

### Ordenação
Decrescente por data (mais nova → mais antiga).
parseNFDate("DD/MM/YYYY") → Date object para comparação.

### Filtros
- Busca por texto: NF number ou fornecedor
- Filtro tipo: Todos | Próprio | Doação | Incorporado

### Paginação
15 notas por página (NF_PER_PAGE = 15).
Usa React.useState local dentro do IIFE do tab (não polui o estado global).

### Cada card de NF mostra:
- Número da NF + badge tipo (colorido)
- Fornecedor
- Data NF · quantidade de itens
- Valor NF total + Valor Atual total
- Barra de progresso de inventário (X/Y itens inventariados)
- Primeiros 4 itens clicáveis → abre modal de detalhe

---

## VARIÁVEIS COMPUTADAS ADICIONADAS AO App.jsx

```javascript
// Todos os itens de TODAS as unidades (para NF tab e busca global)
const todosItens = unidades.flatMap(u =>
  u.itens.map(i => ({ ...i, unidadeNome: u.nome, unidadeId: u.id }))
);

// Parser de data DD/MM/YYYY → Date
const parseNFDate = s => {
  if (!s) return new Date(0);
  const [d, m, y] = s.split('/');
  return new Date(+y, +m-1, +d);
};

// Map de NFs construído a partir de todosItens
const nfDataMap = {}; // { "374": { nf, dataNF, fornecedor, itens[], valorTotal, ... } }
```

---

## CONFIGURAÇÃO DO FIREBASE STORAGE

1. Console Firebase → Storage → Get Started → Next → Done
2. Regras do Storage:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /semcas/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## SECRETS DO GITHUB (sem mudanças em relação à v2)
  VITE_FB_API_KEY
  VITE_FB_PROJECT_ID
  VITE_FB_STORAGE_BUCKET

---

## ORDEM DE DEPLOY

1. Copiar patrimonio_por_unidade.xlsx → public/
2. Criar/substituir todos os arquivos listados acima
3. git add . && git commit -m "v2.1: nf profissional + origem pre-preenchida"
4. git push → GitHub Actions faz o deploy

---

## LIMITES GRATUITOS

| Serviço           | Limite gratuito      | Uso estimado       |
|-------------------|---------------------|--------------------|
| Firebase Firestore| 50K leituras/dia    | ~100/dia           |
| Firebase Storage  | 5 GB storage        | ~2 GB (fotos)      |
| GitHub Pages      | Ilimitado           | —                  |
| IndexedDB         | Ilimitado (browser) | ~10 MB (XLSX)      |
