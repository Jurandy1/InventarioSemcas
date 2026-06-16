# PATCH D — Modal "Ver itens do Local" com fotos e descrições

## Problema

Hoje, na sub-aba "Em Andamento", quando você clica num chip de local, ele troca de sub-aba para "Locais" e abre a visão do local. Funciona, mas:

- Você perde o contexto da lista de inventário
- As fotos são pequenas (thumb 48px)
- Você não consegue ver rapidamente "o que já tem nesse local"

Vamos criar um **modal `LocalDetailModal`** que abre em cima da tela atual, mostra TODOS os itens já registrados no local com fotos grandes, descrições, estado, situação, e permite abrir cada item pra editar.

## Arquivos

- **NOVO**: `src/components/modals/LocalDetailModal.jsx`
- **EDITAR**: `src/app/App.jsx`
- **EDITAR**: `src/pages/InventarioPage.jsx`

## 1. Criar `src/components/modals/LocalDetailModal.jsx`

```jsx
import React, { useMemo } from "react";
import { Overlay } from "../Overlay.jsx";
import { Badge } from "../Badge.jsx";
import { SmartImg } from "../SmartImg.jsx";
import { EC, SC } from "../../constants/inventory.js";
import { sortByDataNF } from "../../utils/itemHelpers.js";
import { isSemTomboItem, SEM_TOMBO_BADGE } from "../../utils/semTombo.js";

/**
 * Modal de detalhe de um Local da sessão.
 *
 * Mostra todos os itens já registrados naquele local com fotos grandes,
 * descrição, estado, situação, marca, fornecedor, valor.
 * Permite abrir um item para editar ou fechar pra voltar pra inventário.
 */
export function LocalDetailModal({
  local,
  isMob,
  unidadesAtivas,
  foundMap,
  onClose,
  onOpenItem,
  onAddManual,
  onAddSemTombo,
  onViewImage,
  bp,
  bs,
}) {
  const itemById = useMemo(() => {
    const map = new Map();
    for (const u of unidadesAtivas) {
      for (const i of u.itens) {
        map.set(i.id, { ...i, unidadeId: u.id, unidadeNome: u.nome });
      }
    }
    return map;
  }, [unidadesAtivas]);

  const itensDoLocal = useMemo(() => {
    if (!local?.id) return [];
    const activeUnitIds = new Set(unidadesAtivas.map((u) => u.id));
    const rows = [];
    for (const id in foundMap) {
      const f = foundMap[id];
      if (!f || f.localId !== local.id) continue;
      if (activeUnitIds.size && f.unidadeId && !activeUnitIds.has(f.unidadeId)) continue;
      const item = itemById.get(id) || itemById.get(f.patrimonioId || "");
      rows.push({ id, found: f, item });
    }
    rows.sort((a, b) => sortByDataNF(a.item, b.item));
    return rows;
  }, [local?.id, foundMap, itemById, unidadesAtivas]);

  if (!local) return null;

  const totalFotos = itensDoLocal.reduce(
    (acc, r) => acc + (Array.isArray(r.found?.fotoUrls) ? r.found.fotoUrls.length : 0),
    0
  );

  return (
    <Overlay isMobile={isMob} onClose={onClose} size="large">
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
        <header style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Local da sessão
          </p>
          <h2 style={{ margin: "2px 0 4px", fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
            {local.nome}
          </h2>
          {local.desc && (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{local.desc}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Badge label={`${itensDoLocal.length} item(s)`} c={{ bg: "#dbeafe", tx: "#1e40af" }} />
            <Badge label={`${totalFotos} foto(s)`} c={{ bg: "#dcfce7", tx: "#166534" }} />
          </div>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {onAddManual && (
            <button
              onClick={() => onAddManual(local.id)}
              style={{ ...bs, padding: "8px 12px", fontSize: 12 }}
            >
              + Adicionar item manual
            </button>
          )}
          {onAddSemTombo && (
            <button
              onClick={() => onAddSemTombo(local.id)}
              style={{ ...bs, padding: "8px 12px", fontSize: 12, borderColor: "#fcd34d", color: "#92400e" }}
            >
              + Item sem tombo
            </button>
          )}
          <button onClick={onClose} style={{ ...bp, padding: "8px 12px", fontSize: 12, marginLeft: "auto" }}>
            Fechar
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
          {itensDoLocal.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, background: "#f8fafc", borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Nenhum item registrado neste local ainda.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Use os botões acima para adicionar.
              </p>
            </div>
          ) : (
            itensDoLocal.map(({ id, found, item }) => {
              const desc =
                found?.descricaoEdit ||
                item?.descricao ||
                item?.especie ||
                found?.obs ||
                "—";
              const fotos = Array.isArray(found?.fotoUrls) ? found.fotoUrls : [];
              const semTombo = isSemTomboItem(item, found);
              const code =
                item?.patrimonioLabel ||
                found?.tomboReferencia ||
                item?.id ||
                "—";
              return (
                <div
                  key={id}
                  style={{
                    border: `1.5px solid ${semTombo ? "#fcd34d" : "#bbf7d0"}`,
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                    display: "flex",
                    gap: 12,
                    flexDirection: isMob ? "column" : "row",
                  }}
                >
                  {/* Galeria de fotos */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexShrink: 0,
                      flexWrap: "wrap",
                      maxWidth: isMob ? "100%" : 240,
                    }}
                  >
                    {fotos.length > 0 ? (
                      fotos.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => onViewImage?.(url)}
                          style={{
                            width: 110,
                            height: 110,
                            borderRadius: 10,
                            border: "1.5px solid #e2e8f0",
                            overflow: "hidden",
                            cursor: "pointer",
                            padding: 0,
                            background: "#f1f5f9",
                          }}
                          title="Ampliar foto"
                        >
                          <SmartImg
                            src={url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        </button>
                      ))
                    ) : (
                      <div
                        style={{
                          width: 110,
                          height: 110,
                          borderRadius: 10,
                          background: "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#94a3b8",
                          fontWeight: 600,
                        }}
                      >
                        Sem fotos
                      </div>
                    )}
                  </div>

                  {/* Detalhes */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                      {desc}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
                      Nº {code}
                      {item?.marca ? ` · ${item.marca}` : found?.marca ? ` · ${found.marca}` : ""}
                      {item?.valor ? ` · R$ ${Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
                    </p>
                    {item?.fornecedor && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                        Fornecedor: {item.fornecedor}
                      </p>
                    )}
                    {item?.nf && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                        NF {item.nf}
                        {item.dataNF ? ` · ${item.dataNF}` : ""}
                      </p>
                    )}
                    {found?.obs && (
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                        Obs: {found.obs}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                      {semTombo && <Badge label={SEM_TOMBO_BADGE.label} c={SEM_TOMBO_BADGE} />}
                      <Badge label={found.estado || "—"} c={EC[found.estado] || { bg: "#f1f5f9", tx: "#334155" }} />
                      <Badge label={found.situacao || "—"} c={SC[found.situacao] || { bg: "#f1f5f9", tx: "#334155" }} />
                      {found.usuario && (
                        <Badge
                          label={`${found.usuario}${found.hora ? ` · ${found.hora}` : ""}`}
                          c={{ bg: "#e0e7ff", tx: "#3730a3" }}
                        />
                      )}
                    </div>
                    {item && onOpenItem && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => {
                            onOpenItem(item);
                            onClose();
                          }}
                          style={{ ...bp, padding: "8px 14px", fontSize: 12 }}
                        >
                          Abrir / editar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Overlay>
  );
}
```

## 2. Integrar em `src/app/App.jsx`

**No topo, junto com os outros imports de modais:**

```js
import { LocalDetailModal } from "../components/modals/LocalDetailModal.jsx";
```

**Adicionar state perto dos outros `useState`:**

```js
const [localDetalhe, setLocalDetalhe] = useState(null); // { id, nome, desc } | null
```

**Renderizar o modal — adicionar próximo aos outros modals (depois de `modal === "manual"` ou similar):**

```jsx
{localDetalhe && (
  <LocalDetailModal
    local={localDetalhe}
    isMob={isMob}
    unidadesAtivas={inventario.unidadesAtivas}
    foundMap={found.foundMap}
    onClose={() => setLocalDetalhe(null)}
    onOpenItem={(item) => openDetModal(item)}
    onAddManual={(localId) => {
      setLocalDetalhe(null);
      formRef.current = {
        manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
        manPatrimonio: "",
        manLocal: String(localId || ""),
        manQtd: 1,
        manSharePhotos: true,
        manOrigem: "Próprio",
      };
      bumpFt();
      setModal("manual");
    }}
    onAddSemTombo={(localId) => {
      setLocalDetalhe(null);
      formRef.current = {
        stMode: "novo",
        stDesc: "",
        stLocal: String(localId || sessionLocais[0]?.id || ""),
        stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
        stEstado: "Bom",
        stObs: "",
        stTomboRef: "",
        stMarca: "",
        stOrigem: "Próprio",
        stPhotos: [],
        stSelectedIds: [],
        stPendSearch: "",
      };
      bumpFt();
      setModal("semTombo");
    }}
    onViewImage={onViewImage}
    bp={bp}
    bs={bs}
  />
)}
```

**Passar handler pra `InventarioPage`:** localizar a passagem de props para `LazyInventarioPage` e adicionar:

```jsx
onOpenLocalDetail={(local) => setLocalDetalhe(local)}
```

E o mesmo para `LazyFinalizadosPage` se quiser disponível lá também.

## 3. Usar o modal em `src/pages/InventarioPage.jsx`

**Receber a prop nova no destructuring de parâmetros da `InventarioPage`:**

```js
export function InventarioPage({
  // ... props existentes ...
  onOpenLocalDetail,   // <-- adicionar
}) {
```

**Localizar o map dos chips de locais (na sub-aba "andamento"):**

```jsx
{locaisOrdenados.map((l) => {
  const countLocal = countFoundInLocal(foundMap, l.id, [...activeUnitIds]);
  return (
    <button
      key={l.id}
      onClick={() => {
        setLocalSelecionadoId(l.id);
        setInvSubTab("locais");
      }}
```

**Substituir o `onClick` para abrir o modal:**

```jsx
{locaisOrdenados.map((l) => {
  const countLocal = countFoundInLocal(foundMap, l.id, [...activeUnitIds]);
  return (
    <button
      key={l.id}
      onClick={() => {
        // Se há handler de modal, usa modal (não troca de sub-aba).
        // Senão, fallback antigo (troca para sub-aba "locais").
        if (onOpenLocalDetail) {
          onOpenLocalDetail(l);
        } else {
          setLocalSelecionadoId(l.id);
          setInvSubTab("locais");
        }
      }}
```

Você também pode duplicar o botão dentro da sub-aba "locais" pra ter um "Ver em modal" — opcional, só se quiser dois caminhos.

## Validação

1. Em uma sessão de inventário com itens já registrados em algum local, clicar no chip do local na aba "Em Andamento" → modal abre.
2. Modal mostra fotos grandes (110x110), descrição, estado, situação, marca, fornecedor, NF.
3. Clicar em "Abrir / editar" leva pro modal do item normalmente, sem perder contexto.
4. Clicar em foto grande → abre overlay de imagem ampliada (`onViewImage`).
5. Adicionar item manual ou sem tombo direto do modal — formulários já abrem pré-preenchidos com o local.
