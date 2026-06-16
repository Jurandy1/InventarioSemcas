# PATCH F — Itens em ordem das NFs mais recentes primeiro

## Problema

No `App.jsx` você já tem o ordenamento por data de NF descendente:

```js
const filtered = React.useMemo(() => {
  const s = deferredSearch.toLowerCase();
  return sessionItens.filter((i) => { /* ... */ });
}, [...]);
const sortedFiltered = useMemo(() => [...filtered].sort(sortByDataNF), [filtered]);
const totalPages = Math.ceil(sortedFiltered.length / PER_PAGE);
const paged = sortedFiltered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
```

Mas na hora de passar pra `InventarioPage`, você passa o **filtered não-ordenado**:

```jsx
<LazyInventarioPage
  ...
  filtered={filtered}    // <-- sem ordenação
  ...
/>
```

E dentro de `InventarioPage`, a lista usa `filtered.slice(...)` direto.

## Arquivo

`src/app/App.jsx`

## Mudança

**Localizar:**

```jsx
            filtered={filtered}
```

Há duas ocorrências (uma no `LazyInventarioPage` e outra no `LazyFinalizadosPage`, se existir lá também). Mas a relevante é a da `InventarioPage`.

**Substituir por:**

```jsx
            filtered={sortedFiltered}
```

## Validação extra do sort

Garantir que o `sortByDataNF` em `src/utils/itemHelpers.js` está ordenando **descendente** (mais recente primeiro). Verificar a função:

```js
export function sortByDataNF(a, b) {
  const da = parseBrDate(a?.dataNF || a?.data || "");
  const db = parseBrDate(b?.dataNF || b?.data || "");
  return db - da;  // desc — mais recente primeiro
}
```

Se estiver `da - db`, troca pra `db - da`.

## Fallback pra itens sem dataNF

Itens manuais ou S/T não têm `dataNF`. O sort atual usa `a?.data` como fallback (`data` é a data do cadastro do bem). Isso é ok — itens novos sobem.

**Bonus**: se quiser que itens recém-inventariados subam pro topo independente da NF (útil pra ver o que você acabou de mexer), pode complementar com:

```js
export function sortByDataNF(a, b, foundMap = {}) {
  const da = parseBrDate(a?.dataNF || a?.data || "");
  const db = parseBrDate(b?.dataNF || b?.data || "");
  return db - da;
}

// Variante: ordena por última edição do inventário (não da NF), pra ver o que você acabou de tocar
export function sortByUltimaAtualizacao(a, b, foundMap = {}) {
  const fa = foundMap[a?.id]?.ultimaAtualizacao || 0;
  const fb = foundMap[b?.id]?.ultimaAtualizacao || 0;
  if (fa && fb) return new Date(fb) - new Date(fa);
  return sortByDataNF(a, b);
}
```

Mas isso é opcional — só adicione se quiser dar a opção de toggle no UI ("Ordenar por: NF recente / Editado recente").

## Validação

1. Abrir uma unidade com itens de várias datas de NF.
2. O primeiro card da lista deve ser o de NF mais recente (verificar no card o campo "NF XXXX" e data).
3. Buscar por uma palavra — resultados filtrados continuam em ordem decrescente de NF.
4. Mudar de página — itens da próxima página têm NFs mais antigas.
