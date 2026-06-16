# PATCH G — Sugestões só na Descrição + ranking decente + perf

## O que está acontecendo

1. **"A espécie gerada tem nada a ver com o item"** — o `ManualModal` chama `inferEspecieFromDesc(v, sugestoes.especies)` a cada tecla digitada na descrição. Como `sugestoes.especies` cruza dados de várias unidades, ele acerta um match parcial qualquer e enfia em "Espécie" sem pedir permissão.
2. **"Marca sugerida sem sentido"** — os campos Espécie, Marca, Fornecedor recebem `suggestions=` mesmo quando você só quer no campo Descrição.
3. **"Quando digito 'cadeira' seleciona aleatório"** — em `FormFields.jsx::TInput`, o filtro é `key.includes(q)` (match em qualquer posição) e depois `out.sort(safeLocaleCompare)` (ordem **alfabética**). Resultado: "ABRAÇADEIRA DE INOX" vence "CADEIRA SIMPLES" no topo da lista.
4. **"Gargalando demais"** — cada tecla digitada roda `stripDiacritics` sobre todas as ~1200 sugestões. Sem memoização. Trava em mobile fraco.

## Arquivos

- `src/components/FormFields.jsx`
- `src/components/modals/ManualModal.jsx`
- (opcional, recomendado) `src/components/modals/SemTomboModal.jsx` — mesma limpeza
- (opcional) `src/app/App.jsx` — escopo das sugestões

---

## 1. Reescrever o `TInput` (FormFields.jsx)

Substitui ranking alfabético por **scoring por relevância** e pré-normaliza a lista uma vez quando ela muda (não a cada tecla).

### Localizar a função `TInput` inteira e substituir por:

```jsx
export function TInput({ initial, onVal, suggestions = [], onSuggestionSelect, ...p }) {
  const [v, setV] = useState(initial || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setV(initial || "");
  }, [initial]);

  // Pré-normaliza a lista UMA VEZ quando ela muda (não a cada tecla).
  // Cada item vira { raw, norm, words } pra evitar refazer stripDiacritics no filtro.
  const normalizedSuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of suggestions || []) {
      if (!s) continue;
      const raw = String(s).trim();
      if (!raw) continue;
      const norm = stripDiacritics(raw).toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({ raw, norm, words: norm.split(/\s+/).filter(Boolean) });
    }
    return out;
  }, [suggestions]);

  // Filtro + ranking por relevância (não alfabético).
  // Score:
  //   100 = match exato (digitou a sugestão inteira)
  //    80 = sugestão começa com o que foi digitado
  //    60 = alguma palavra da sugestão começa com o que foi digitado
  //    40 = digitado aparece como substring em algum lugar
  // Empate: a sugestão MAIS CURTA vence (provavelmente o termo "puro" — "CADEIRA"
  // ganha de "CADEIRA EXECUTIVA GIRATÓRIA COM BRAÇO HOSPITALAR").
  const filtered = useMemo(() => {
    const q = stripDiacritics(String(v)).toLowerCase().trim();
    if (!q) return [];

    const scored = [];
    for (const { raw, norm, words } of normalizedSuggestions) {
      let score = 0;
      if (norm === q) score = 100;
      else if (norm.startsWith(q)) score = 80;
      else if (words.some((w) => w.startsWith(q))) score = 60;
      else if (norm.includes(q)) score = 40;

      if (score === 0) continue;
      scored.push({ raw, norm, score });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.norm.length !== b.norm.length) return a.norm.length - b.norm.length;
      return safeLocaleCompare(a.raw, b.raw);
    });

    return scored.slice(0, 8).map((x) => x.raw);
  }, [normalizedSuggestions, v]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const renderSuggestion = (suggestion) => {
    const inputRaw = String(v || "");
    const inputNorm = stripDiacritics(inputRaw).toLowerCase().trim();
    const { norm: sugNorm, map } = normalizeWithMap(String(suggestion));
    const idxNorm = inputNorm ? sugNorm.toLowerCase().indexOf(inputNorm) : -1;

    if (idxNorm < 0) return <span>{suggestion}</span>;

    const start = map[idxNorm] ?? 0;
    const end = (map[idxNorm + inputNorm.length - 1] ?? start) + 1;
    const before = String(suggestion).slice(0, start);
    const hit = String(suggestion).slice(start, end);
    const after = String(suggestion).slice(end);

    return (
      <span>
        {before}
        <strong style={{ color: "#1d4ed8", fontWeight: 700 }}>{hit}</strong>
        {after}
      </span>
    );
  };

  const chooseSuggestion = (suggestion) => {
    setV(suggestion);
    onVal(suggestion);
    onSuggestionSelect?.(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <input
        {...p}
        value={v}
        onChange={(e) => {
          const next = e.target.value;
          setV(next);
          onVal(next);
          // Só mostra dropdown se há lista de sugestões ATIVA.
          // Sem isso, o componente abria um dropdown vazio em campos sem suggestions.
          if (normalizedSuggestions.length > 0) setShowSuggestions(true);
        }}
        onFocus={() => {
          if (normalizedSuggestions.length > 0 && String(v).trim().length > 0) {
            setShowSuggestions(true);
          }
        }}
      />

      {showSuggestions && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1.5px solid #d1d5db",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            maxHeight: 200,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
          }}
        >
          {filtered.map((suggestion, i) => (
            <button
              key={`${suggestion}-${i}`}
              type="button"
              onClick={() => chooseSuggestion(suggestion)}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseSuggestion(suggestion);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                chooseSuggestion(suggestion);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                chooseSuggestion(suggestion);
              }}
              style={{
                width: "100%",
                padding: "10px 13px",
                textAlign: "left",
                border: "none",
                background: i % 2 === 0 ? "#f8fafc" : "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                transition: "background .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#f8fafc" : "#fff")}
            >
              {renderSuggestion(suggestion)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Mudanças em relação ao original:**

- `normalizedSuggestions` pré-processa a lista. Só refaz quando `suggestions` muda. Reduz custo por tecla de O(N × stripDiacritics) pra O(N) puro de comparação string.
- `filtered` agora pontua e ordena por relevância. Match exato > começa com > palavra começa com > contém. Sem mais ordem alfabética.
- O dropdown só abre se a lista de sugestões tem itens. Campos com `suggestions={[]}` ou sem suggestions não geram dropdown vazio nem disparam re-renders desnecessários.
- Removi o segundo `rx.test(hit)` redundante no `renderSuggestion` (era um if que terminava no mesmo return).

---

## 2. ManualModal — sugestões SÓ na descrição + remover auto-infer

### Localizar o campo "Descrição":

```jsx
      <TInput
        key={"manDesc_" + ft}
        initial={getField("manDesc")}
        onVal={(v) => {
          setField("manDesc", v);
          if (!String(getField("manEspecie") || "").trim()) {
            setField("manEspecie", inferEspecieFromDesc(v, sugestoes.especies));
            bumpFt();
          }
        }}
        placeholder="Descreva o item..."
        suggestions={sugestoes.descricoes}
        style={inp}
      />
```

### Substituir por:

```jsx
      <TInput
        key={"manDesc_" + ft}
        initial={getField("manDesc")}
        onVal={(v) => setField("manDesc", v)}
        placeholder="Descreva o item..."
        suggestions={sugestoes.descricoes}
        style={inp}
      />
```

> **Removido**: o auto-preenchimento de Espécie. Você preenche a espécie manualmente (ou deixa o sistema gerar do primeiro token no `addManual` como fallback final).

### Localizar Espécie:

```jsx
      <TInput key={"manEsp_" + ft} initial={getField("manEspecie")} onVal={(v) => setField("manEspecie", v)} placeholder="Ex: CADEIRA, MESA..." suggestions={sugestoes.especies} style={inp} />
```

### Substituir por:

```jsx
      <TInput key={"manEsp_" + ft} initial={getField("manEspecie")} onVal={(v) => setField("manEspecie", v)} placeholder="Ex: CADEIRA, MESA..." style={inp} />
```

### Localizar Marca:

```jsx
      <TInput key="manMarca" initial={getField("manMarca")} onVal={(v) => setField("manMarca", v)} placeholder="Marca..." suggestions={sugestoes.marcas} style={inp} />
```

### Substituir por:

```jsx
      <TInput key="manMarca" initial={getField("manMarca")} onVal={(v) => setField("manMarca", v)} placeholder="Marca..." style={inp} />
```

### Localizar Fornecedor:

```jsx
      <TInput key="manForn" initial={getField("manFornecedor")} onVal={(v) => setField("manFornecedor", v)} placeholder="Fornecedor..." suggestions={sugestoes.fornecedores} style={inp} />
```

### Substituir por:

```jsx
      <TInput key="manForn" initial={getField("manFornecedor")} onVal={(v) => setField("manFornecedor", v)} placeholder="Fornecedor..." style={inp} />
```

### Limpar o import não usado (opcional)

Como o `inferEspecieFromDesc` não é mais chamado no `ManualModal`, dá pra remover ele da lista de props recebidas pelo componente:

**Localizar:**

```jsx
export function ManualModal({
  isMob,
  overlayBackdropSuppressMs,
  revokeBlobUrls,
  formRef,
  clearUiResume,
  setModal,
  getField,
  setField,
  inferEspecieFromDesc,    // <-- não usa mais
  sugestoes,
  bumpFt,
```

Pode deixar — `inferEspecieFromDesc` é uma prop opcional não usada agora, sem efeito colateral. Remover é só estética.

---

## 3. (Opcional, recomendado) SemTomboModal — mesma limpeza

Se o `SemTomboModal` também tem TInputs em campos não-descrição com `suggestions=`, faça a mesma cirurgia. Olhe especificamente Marca, Fornecedor, qualquer outro campo lateral.

**Princípio**: só passa `suggestions={...}` no campo Descrição. Os outros viram campo de input puro.

---

## 4. (Opcional) Escopo: não vazar sugestões entre unidades

### `src/app/App.jsx`

**Localizar:**

```js
  const sugestoes = React.useMemo(() => {
    if (!needsSugestoes) return EMPTY_SUGESTOES;
    const base =
      inventario.unidadesAtivas.length > 0
        ? inventario.unidadesAtivas.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeNome: u.nome, unidadeId: u.id })))
        : todosItens.slice(0, 400);
    return gerarTodasSugestoes(base);
  }, [needsSugestoes, inventario.unidadesAtivas, todosItens]);
```

**Substituir por:**

```js
  // Sugestões de DESCRIÇÃO são úteis globalmente — usar a base inteira deixa
  // o usuário aproveitar termos de outras unidades (ex: "CADEIRA GIRATÓRIA").
  // Para outros campos (espécie/marca/fornecedor) não estamos mais usando
  // suggestions no ManualModal, então não precisamos limitar a escopo de unidade.
  const sugestoes = React.useMemo(() => {
    if (!needsSugestoes) return EMPTY_SUGESTOES;
    // Base global para descrições (incluindo sugestoesDoacao.json).
    // gerarTodasSugestoes já desduplica e ordena.
    return gerarTodasSugestoes(todosItens);
  }, [needsSugestoes, todosItens]);
```

> Se você quiser MANTER o comportamento antigo de limitar a 400 quando não há unidade ativa (memória), pode usar `todosItens.slice(0, 1500)` em vez de `todosItens` — 1500 itens é suficiente pra ter uma boa coleção de descrições e ainda é leve.

---

## 5. (Opcional, mais drástico) Reduzir o payload de `gerarTodasSugestoes`

Como só você usa **descrições** agora, daria pra `gerarTodasSugestoes` retornar listas vazias pros outros campos e economizar trabalho:

### `src/utils/suggestions.js`

**Localizar:**

```js
export function gerarTodasSugestoes(todosItens) {
  return {
    descricoes: gerarSugestoesDescricao(todosItens),
    especies: gerarSugestoesEspecie(todosItens),
    marcas: gerarSugestoesMarca(todosItens),
    fornecedores: gerarSugestoesFornecedor(todosItens),
  };
}
```

**Substituir por:**

```js
export function gerarTodasSugestoes(todosItens) {
  // Hoje só usamos descrições. Mantemos as outras funções públicas (caso
  // outro lugar do código ainda use), mas o objeto consolidado só monta
  // a lista pesada de descrições — economiza ~3 varreduras desnecessárias
  // sobre todosItens a cada mudança de unidade ativa.
  return {
    descricoes: gerarSugestoesDescricao(todosItens),
    especies: [],
    marcas: [],
    fornecedores: [],
  };
}
```

> Se algum dia você quiser ressuscitar sugestões em outros campos, é só recolocar a chamada da função correspondente.

---

## Validação

1. Abrir Manual, digitar "cadeira" na descrição.
   - Dropdown deve mostrar primeiro variações que **começam com "CADEIRA"** (CADEIRA, CADEIRA GIRATÓRIA, CADEIRA SIMPLES).
   - "ABRAÇADEIRA" e similares NÃO devem aparecer no topo. Só aparecem lá no fim (score 40) ou nem aparecem se houver suficientes matches melhores.
2. Continuar digitando "cadeira giratória" — refina pra apenas variações relevantes.
3. **Espécie NÃO deve auto-preencher** quando você digita na descrição.
4. **Marca, Fornecedor, Espécie** não devem mais mostrar dropdown de sugestões.
5. Digitar em descrição com 1200+ sugestões na base — sem travamento perceptível em mobile.

## Notas

- O comportamento de `addManual` no `App.jsx` ainda tem um fallback caso a espécie venha vazia: `especie: getField("manEspecie") || desc.split(" ")[0].toUpperCase()`. Esse fallback de "primeiro token em maiúscula" continua existindo. Se quiser eliminar isso também, troque por uma string vazia: `especie: getField("manEspecie") || ""`. Aí o usuário é forçado a preencher manualmente (mais correto, mas exige mais clique).
- Se em algum momento você quiser ressuscitar uma "sugestão inteligente de espécie", o caminho certo é um botão dedicado no UI ("Sugerir da descrição") em vez de auto-fill silencioso. Pode adicionar depois.
