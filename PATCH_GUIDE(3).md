# PATCH — Inventário SEMCAS v2.2
# Correção de 68 itens incompletos + fix valorAtual (738 itens)

---

## CONTEXTO DOS PROBLEMAS CORRIGIDOS

### Problema 1 — 68 itens com apenas tombo (sem nenhum dado)
Linhas da planilha que tinham SOMENTE o número de patrimônio preenchido (células B–O
estavam mescladas e vazias). O sistema os listava como "Registros incompletos" no
Dashboard e eles apareciam como "Pendente" mas sem descrição, espécie ou valor.

**Root cause:** O arquivo `.xlsx` tinha esses registros em linhas mescladas (`A:O`)
cujos dados não foram transferidos corretamente na geração do relatório original.

**Solução:** Dados extraídos do PDF `pmr00002-7.pdf` (relatório oficial, 1.178 páginas)
e inseridos na planilha. As 68 linhas foram desm‌ergidas e preenchidas.

### Problema 2 — 738 itens com `valorAtual = 0` (bug do parser)
A coluna 13 (`Valor NF/Reavaliado`) às vezes contém DOIS valores colados, ex:
`"5.270,00 3.451,85"`, onde o segundo é o `Valor Atual`. Quando isso acontece,
a coluna 14 (`Valor Atual`) fica vazia. O parser antigo só extraía o primeiro
número, zerando o `valorAtual` de 738 itens.

**Solução:** Nova função `parseValPair()` em `xlsx.js` detecta quando col14 está
vazia e extrai o segundo número de col13 como `valorAtual`.

### Problema 3 — Cache IndexedDB stale
O cache `"unidades_v2"` guardava os dados antigos (com os 68 itens vazios).
Mesmo após trocar o `.xlsx` no servidor, usuários viam os dados antigos por até
24h. A chave foi bumped para `"unidades_v3"` para forçar recarga automática.

---

## ARQUIVOS DESTA ATUALIZAÇÃO

### SUBSTITUIR (apagar o antigo, colar o novo)
| Arquivo | O que mudou |
|---------|-------------|
| `src/utils/xlsx.js` | Cache key v3 + `parseValPair()` + fix 738 itens valorAtual |

### ADICIONAR NO REPOSITÓRIO
```
public/
  patrimonio_por_unidade.xlsx   ← substituir pela versão corrigida (68 itens preenchidos)
```

### SEM MUDANÇA
Todos os outros arquivos (`App.jsx`, `firebase.js`, `storage.js`, etc.) ficam iguais.

---

## DETALHES DO NOVO `src/utils/xlsx.js`

### Cache key bumped
```js
// ANTES
const CACHE_KEY = "unidades_v2";
// DEPOIS
const CACHE_KEY = "unidades_v3";  // força recarga ao trocar o xlsx
```

### Nova função `parseValPair`
```js
// Substitui chamadas separadas a parseVal(g("Valor NF/...")) e parseVal(g("Valor Atual"))
function parseValPair(valorRaw, valorAtualRaw) {
  const nums = String(valorRaw || "").match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
  const valor = nums.length > 0
    ? parseFloat(nums[0].replace(/\./g, "").replace(",", "."))
    : parseVal(valorRaw);

  // col14 preenchida → usa normalmente
  if (valorAtualRaw && String(valorAtualRaw).trim() && String(valorAtualRaw).trim() !== "/") {
    return [valor, parseVal(valorAtualRaw)];
  }
  // col14 vazia + col13 tem dois valores → extrai o segundo
  if (nums.length >= 2) {
    return [valor, parseFloat(nums[1].replace(/\./g, "").replace(",", "."))];
  }
  return [valor, 0];
}
```

### Uso no loop de parseXLSX
```js
// ANTES
cur.itens.push({
  ...
  valor: parseVal(g("Valor NF/Reavaliado")),
  valorAtual: parseVal(g("Valor Atual")),
});

// DEPOIS
const [valor, valorAtual] = parseValPair(
  g("Valor NF/Reavaliado"),
  g("Valor Atual")
);
cur.itens.push({ ..., valor, valorAtual });
```

---

## MAPEAMENTO DE COLUNAS DO XLSX (atualizado v2.2)

| Índice | Nome no cabeçalho    | Campo no objeto   | Notas |
|--------|---------------------|-------------------|-------|
| 0      | Patrimônio          | id                | |
| 1      | Data                | data              | |
| 2      | Espécie             | especie           | Sempre preenchida após v2.2 |
| 3      | Descrição           | descricao         | Pode ser vazia; ~1.627 itens só têm espécie |
| 4      | Marca               | marca             | |
| 5      | Fornecedor          | fornecedor        | |
| 6      | Empenho             | empenho           | |
| 7      | N.F.                | nf                | |
| 8      | Data N.F.           | dataNF            | |
| 9      | Tombamento          | (ignorado)        | |
| 10     | Situação            | (ignorado)        | |
| 11     | Data Baixa          | (ignorado)        | |
| 12     | Valor NF/Reavaliado | valor             | ⚠️ Às vezes contém DOIS valores colados — usar parseValPair |
| 13     | Valor Atual         | valorAtual        | Pode estar vazio quando col12 tem dois valores |
| 14     | Natureza            | (ignorado)        | |
| 15     | Tipo de Entrada     | tipoEntrada       | |

**ATENÇÃO:** col12 tem duas variantes:
- `"5.270,00"` → só valor NF (col13 tem valorAtual separado) — 5964 itens
- `"5.270,00 3.451,85"` → ambos colados, col13 vazia — 738 itens

**A função `parseValPair()` lida com ambos os casos automaticamente.**

---

## ESTADO DOS DADOS APÓS v2.2

| Métrica | Valor |
|---------|-------|
| Total de itens | 6.702 |
| Itens com espécie | 6.540 (97,6%) |
| Itens com descrição | 5.071 (75,7%) |
| Itens com valor > 0 | 6.671 (99,5%) |
| Itens sem NENHUM dado | 0 ✅ |
| Itens com valorAtual correto | 6.658 ✅ (era 5.920 antes) |
| Itens que eram "corrompidos" | 0 ✅ (eram 68 antes) |

### Os 68 itens corrigidos incluem:
```
SCANNER, IMPRESSORA, TELEVISOR (múltiplos), CADEIRA (múltiplos),
AR CONDICIONADO, ARMÁRIO EM AÇO (múltiplos), MESA (múltiplos),
ESTABILIZADOR, RACK, MICROFONE, FRAGMENTADORA, SWITCH, CÂMERA,
VENTILADOR, LIQUIDIFICADOR, MONITOR, ROTEADOR, GAVETEIRO, etc.
```

---

## LÓGICA DO TIPO DE ENTRADA (sem mudança)

Valores possíveis no XLSX → normalização:
  `"INCORPORADO"` → `tipoEntrada = "Incorporado"`
  `"DOAÇÃO"` → `tipoEntrada = "Doação"`
  `""` (vazio) → `tipoEntrada = "Próprio"`

---

## COMO EXIBIR ITENS SEM DESCRIÇÃO NO MODAL

Itens com `descricao = ""` mas `especie != ""` são legítimos (1.627 itens).
O modal de detalhe já usa `item.descricao || item.especie || "—"`.
Não é preciso mudar o App.jsx para isso.

---

## ORDEM DE DEPLOY

1. Substituir `public/patrimonio_por_unidade.xlsx` pela versão corrigida
2. Substituir `src/utils/xlsx.js` pelo novo arquivo
3. `git add . && git commit -m "v2.2: fix 68 itens vazios + fix valorAtual 738 itens + cache v3"`
4. `git push` → GitHub Actions faz o deploy
5. Usuários terão o cache invalidado automaticamente na próxima abertura

---

## SECRETS DO GITHUB (sem mudanças)
  VITE_FB_API_KEY
  VITE_FB_PROJECT_ID
  VITE_FB_STORAGE_BUCKET

---

## POR QUE OS ITENS CORRIGIDOS AINDA APARECEM COMO "NÃO INVENTARIADOS"

Os 68 itens agora têm dados completos na planilha, mas **ninguém os inventariou
fisicamente ainda**. O status "Pendente" (fundo branco, sem badge verde) é correto —
significa que o item existe no sistema mas ainda não foi localizado e registrado
com foto/estado/local. Isso é diferente de "dado incompleto".

Para inventariar: abrir o item → tirar foto → selecionar estado/local → salvar.

---

## LIMITES GRATUITOS (sem mudanças)

| Serviço | Limite gratuito | Uso estimado |
|---------|----------------|--------------|
| Firebase Firestore | 50K leituras/dia | ~100/dia |
| Firebase Storage | 5 GB storage | ~2 GB (fotos) |
| GitHub Pages | Ilimitado | — |
| IndexedDB | Ilimitado (browser) | ~10 MB (XLSX) |

---

# PATCH — Inventário SEMCAS v2.3
# Aba Itens: categorias inteligentes + fotos + filtros avançados

## O QUE MUDA

### Aba Itens — redesign completo
- **Mostra TODOS os itens** de todas as unidades (antes: só a unidade ativa)
- **Sidebar de categorias** (desktop) com 10 grupos semânticos e contagem
- **Chips de categoria** horizontais (mobile)
- **Fotos do inventário**: cards mostram a 1ª foto tirada durante o inventário
- **Indicador de fotos múltiplas**: badge "📷 N" quando há mais de uma foto
- **Filtro de status**: Todos / ✅ Inventariados / ⏳ Pendentes
- **Filtro de unidade**: dropdown com todas as 98 unidades
- **Filtro de estado de conservação**: Novo / Ótimo / Bom / Regular / Ruim / Inservível
- **Busca livre** por descrição, Nº, marca, NF
- **Grid responsivo**: 2 colunas no mobile, auto-fill no desktop
- **Paginação**: 24 itens por página

## CATEGORIAS (10 grupos com regex inteligente)

| Ícone | Categoria | Qtd |
|-------|-----------|-----|
| 🪑 | Cadeiras | ~2.939 |
| 🪞 | Mesas | ~969 |
| 🗄️ | Armários | ~889 |
| ❄️ | Climatização | ~484 |
| 🍳 | Cozinha | ~293 |
| 💻 | Informática | ~240 |
| 📺 | TV / AV | ~221 |
| 📦 | Outros | ~401 |
| 🔌 | Rede / TI | ~155 |
| 🏥 | Saúde | ~111 |

## ARQUIVOS DESTA ATUALIZAÇÃO

### MODIFICAR
| Arquivo | O que mudar |
|---------|-------------|
| `src/app/App.jsx` | Adicionar `CATEGORY_DEFS` + `getCategoryGroup` antes do return(); substituir bloco `{tab === "itens" && ...}` |

### ARQUIVO DE PATCH
`itens_tab_patch.jsx` — contém o bloco completo pronto para colar

## INSTRUÇÕES DE APLICAÇÃO

1. Abrir `src/app/App.jsx`

2. Localizar o bloco `const origemMeta = { ... }` (por volta da linha 180 do arquivo)
   e inserir APÓS ele:
   ```jsx
   const CATEGORY_DEFS = [ ... ];   // ver itens_tab_patch.jsx — PASSO 2
   function getCategoryGroup(especie) { ... }
   ```

3. Localizar `{tab === "itens" && (` e deletar tudo até o `)}` de fechamento correspondente

4. Colar o conteúdo da seção "── PASSO 3 ──" do `itens_tab_patch.jsx`

5. `git commit -m "v2.3: aba itens com categorias + fotos + filtros"` e push

## DEPENDÊNCIAS
- Usa `todosItens` (já definido no App.jsx)
- Usa `foundMap`, `foundSet`, `unidades`, `saveAtiva`, `form`, `setFt`, `setModal`
- Usa componentes `Badge`, `TInput` existentes
- Usa constantes `EC`, `ESTADOS`, `cd`, `bs`, `inp` existentes
- **Não requer novos pacotes npm**
