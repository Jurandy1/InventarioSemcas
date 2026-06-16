# PATCH C — Finalização triplicou (CREAS SOL E MAR apareceu 3x)

## Problema

Na sua tela "Finalizados" o CREAS SOL E MAR apareceu 3 vezes — 2 com stats verdes completos (109/129 · 84%) e 1 como "legado" só com tombosNE. Isso indica dois problemas combinados:

1. **Sem guard de duplo-clique**: `finalizarComCoordenadora` em `App.jsx` não verifica `busy` antes de executar. Clique duplo no botão "Finalizar" da modal cria dois `criarFinalizacao` paralelos.
2. **Sem idempotência por `sessionId`**: `criarFinalizacao` em `services/finalizacoes.js` não verifica se já existe uma finalização para o mesmo `sessionId + unidadeIds` antes de criar.
3. **Listagem mostra legado + novo somados**: o `useFinalizacoes` une finalizações novas com legacy de `tombosNE` sem deduplicar, então uma finalização que também criou tombosNE pode aparecer 2x.

## Arquivos

- `src/app/App.jsx`
- `src/services/finalizacoes.js`
- `src/hooks/useFinalizacoes.js` (se existir lógica de merge — verificar)

## Mudança 1 — Guard de busy + desabilitar botão

### `src/app/App.jsx`

**Localizar:**

```js
  const finalizarComCoordenadora = async () => {
    const nome = String(getField("coordNome") || "").trim();
    const matricula = String(getField("coordMatricula") || "").trim();
    if (!nome || !matricula) {
      showT("Preencha nome e matrícula da coordenadora");
      return;
    }
    if (inventario.unidadesAtivas.length === 0) {
      showT("Nenhuma unidade em inventário");
      return;
    }
```

**Substituir por:**

```js
  const finalizandoRef = useRef(false);
  const finalizarComCoordenadora = async () => {
    if (finalizandoRef.current || busy) {
      showT("Finalização em andamento — aguarde");
      return;
    }
    const nome = String(getField("coordNome") || "").trim();
    const matricula = String(getField("coordMatricula") || "").trim();
    if (!nome || !matricula) {
      showT("Preencha nome e matrícula da coordenadora");
      return;
    }
    if (inventario.unidadesAtivas.length === 0) {
      showT("Nenhuma unidade em inventário");
      return;
    }
    finalizandoRef.current = true;
    setBusy(true);
```

> **Importante**: a linha `const finalizandoRef = useRef(false);` deve ficar JUNTO dos outros `useRef` no topo do componente, NÃO dentro da função. Mova-a para perto dos refs existentes:
>
> ```js
> const formRef = useRef({});
> const editingItemRef = useRef(null);
> const manualPatrimonioRef = useRef(null);
> const resumeRestoredRef = useRef(false);
> const cameraTargetRef = useRef(null);
> const finalizandoRef = useRef(false);   // <-- adicionar aqui
> ```
>
> E remover a linha `const finalizandoRef = useRef(false);` que ficou dentro de `finalizarComCoordenadora`.

**Adicionar bloco try/finally** envolvendo o resto da função. Localizar o final:

```js
    setModal("qrcode-resultado");
    showT("Convite criado! A coordenadora se cadastra pelo QR Code e você aprova em Coordenadores.");
  };
```

**Substituir por:**

```js
    setModal("qrcode-resultado");
    showT("Convite criado! A coordenadora se cadastra pelo QR Code e você aprova em Coordenadores.");
    setBusy(false);
    finalizandoRef.current = false;
  };
```

E em todos os outros caminhos de retorno antecipado dentro da função (`if` de erro, etc.) adicione `setBusy(false); finalizandoRef.current = false;` antes do `return`. Se preferir, envolva todo o corpo em `try/catch/finally`:

```js
  const finalizarComCoordenadora = async () => {
    if (finalizandoRef.current || busy) {
      showT("Finalização em andamento — aguarde");
      return;
    }
    // ... validações iniciais ...
    finalizandoRef.current = true;
    setBusy(true);
    try {
      // ... todo o corpo atual da função ...
    } catch (err) {
      console.error("Erro ao finalizar:", err);
      showT("Erro ao finalizar — tente novamente");
    } finally {
      setBusy(false);
      finalizandoRef.current = false;
    }
  };
```

### Desabilitar o botão na `FinalizarModal`

`src/components/modals/FinalizarModal.jsx` — localizar o botão "Confirmar" / "Finalizar com Coordenadora" e adicionar `disabled={busy}` + `opacity` reduzida. Se o modal não recebe `busy` por prop, passar via:

`src/app/App.jsx`:

```jsx
{modal === "finalizar" && (
  <FinalizarModal
    isMob={isMob}
    setModal={setModal}
    inventario={inventario}
    getField={getField}
    setField={setField}
    finalizarComCoordenadora={finalizarComCoordenadora}
    busy={busy}                              // <-- adicionar
    bs={bs}
    bp={bp}
    inp={inp}
  />
)}
```

E na `FinalizarModal`:

```jsx
<button
  onClick={finalizarComCoordenadora}
  disabled={busy}
  style={{ ...bp, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
>
  {busy ? "Finalizando..." : "Confirmar finalização"}
</button>
```

## Mudança 2 — Idempotência em `criarFinalizacao`

### `src/services/finalizacoes.js`

**Localizar a função `criarFinalizacao`** (deve estar perto do topo do arquivo). Adicionar no início dela uma verificação por `sessionId`:

```js
import { fsGetAll, fsSet, fsGetDoc } from "./firebase.js";

export async function criarFinalizacao(payload) {
  const sessionId = String(payload?.sessionId || "").trim();
  const unidadeIdsKey = (payload?.unidadeIds || []).slice().sort().join(",");

  // Idempotência: se já existe uma finalização com este sessionId E mesmas
  // unidades nas últimas 24h, retorna a existente em vez de criar duplicata.
  if (sessionId) {
    try {
      const existentes = await fsGetAll("finalizacoes");
      const ontem = Date.now() - 24 * 60 * 60 * 1000;
      const hit = existentes.find((f) => {
        if (f.sessionId !== sessionId) return false;
        const fIds = (f.unidadeIds || []).slice().sort().join(",");
        if (fIds !== unidadeIdsKey) return false;
        const ts = new Date(f.dataFinalizacao || f.createdAt || 0).getTime();
        return ts > ontem;
      });
      if (hit) {
        console.warn("[criarFinalizacao] já existe finalização recente para esta sessão:", hit.id);
        return hit;
      }
    } catch (e) {
      console.warn("[criarFinalizacao] erro ao checar duplicatas:", e);
    }
  }

  // ... resto do código existente da função ...
}
```

> Substitua o `// ... resto do código existente da função ...` pelo corpo real que já está lá. A ideia é só inserir o bloco de idempotência ANTES do que já existe.

## Mudança 3 — Deduplicação na listagem (proteção extra)

### `src/hooks/useFinalizacoes.js`

Se você não consegue alterar todas as finalizações antigas duplicadas no Firestore, adicione um dedup na listagem como cinto de segurança:

**Localizar** o lugar onde as finalizações são montadas para a UI (provavelmente `setFinalizacoes(...)` depois de buscar do Firestore). Adicionar deduplicação por `sessionId + unidadeIdsKey`:

```js
function dedupFinalizacoes(lista) {
  const seen = new Map();
  for (const f of lista) {
    if (f.legacy) {
      // legadas (apenas tombosNE) não têm sessionId — mantemos como estão
      seen.set(`legacy_${f.id}`, f);
      continue;
    }
    const key = `${f.sessionId || f.id}|${(f.unidadeIds || []).slice().sort().join(",")}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, f);
    } else {
      // Manter a mais recente; se a mais nova tem mais stats, prefere ela
      const tsExisting = new Date(existing.dataFinalizacao || existing.createdAt || 0).getTime();
      const tsNew = new Date(f.dataFinalizacao || f.createdAt || 0).getTime();
      if (tsNew > tsExisting) seen.set(key, f);
    }
  }
  return [...seen.values()];
}
```

E aplicar no momento de setar o state:

```js
setFinalizacoes(dedupFinalizacoes(rawList));
```

## Mudança 4 — Limpar as 2 duplicatas que já existem (manual, uma vez)

No console do Firebase ou via script Node:

1. Abra a coleção `finalizacoes` no Firestore.
2. Filtre por `sessionId` igual ao do CREAS SOL E MAR (15/06/2026).
3. Você verá 2 (ou 3) docs com o mesmo `sessionId`. Mantenha o mais recente, exclua os outros.

Se preferir um script, posso gerar um patch separado de cleanup.

## Validação

1. Iniciar inventário em uma unidade, finalizar com coordenadora — só 1 card deve aparecer.
2. Duplo-clique no botão "Confirmar" durante a finalização — não deve criar duplicata.
3. Encerrar app no meio da finalização (Ctrl+F5) e refazer — não deve criar duplicata (idempotência por sessionId).
