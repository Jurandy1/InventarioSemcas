# Inventário SEMCAS — 6 Patches

Aplicar **na ordem** A → B → C → D → E → F. Cada patch é independente, mas seguir essa ordem evita conflitos de merge porque os mais pesados ficam por último.

| Patch | Arquivo | Tipo | Tempo estimado |
|---|---|---|---|
| **A** | `PATCH_A_camera_tela_preta.md` | Bug | 5 min |
| **B** | `PATCH_B_fotos_multiplas.md` | Bug | 10 min |
| **C** | `PATCH_C_finalizacao_triplicada.md` | Bug + idempotência | 20 min |
| **D** | `PATCH_D_modal_detalhe_local.md` | Feature (novo modal) | 25 min |
| **E** | `PATCH_E_modal_varios_itens.md` | Feature (novo modal) | 35 min |
| **F** | `PATCH_F_ordem_nf_recente.md` | Bug (1 linha) | 2 min |

## Resumo do que cada um resolve

### A. Câmera preta no celular
`videoRef.current.srcObject` é atribuído antes do React montar o `<video>`. Fix: useEffect que ancora o stream quando ambos existem.

### B. Fotos quebrando ao tirar várias
`revokeBlobUrls(formRef.current.manPhotos)` revoga URLs que o próprio `CameraModal` devolve no novo array. Fix: revogar só o que **saiu** + converter pra dataURL na captura.

### C. CREAS SOL E MAR finalizou 3x
Sem guard de busy + sem idempotência por sessionId. Fix: `finalizandoRef` + check de duplicata em `criarFinalizacao` + dedup na listagem.

### D. Tela do Local com tudo
Novo modal `LocalDetailModal` que abre em cima de qualquer aba, mostra fotos grandes (110x110), descrição, estado, situação, marca, fornecedor, NF, e permite editar item ou adicionar manual/sem tombo direto.

### E. Adicionar vários itens com mesma descrição
Novo modal `MultiItemModal`: descrição/marca/fornecedor compartilhados no topo, N linhas individuais cada uma com tombamento + estado + foto próprios. Salva todos numa só ação.

### F. Ordem por NF mais recente
`InventarioPage` recebe `filtered` em vez de `sortedFiltered`. Trocar 1 nome de variável.

## Itens já existentes a limpar manualmente

No Firestore, coleção `finalizacoes`:
- 2 documentos duplicados do CREAS SOL E MAR de 15/06/2026 — manter o mais recente, deletar os outros.
- O entry "legado" (sem stats) pode ser ignorado ou deletado pra ficar limpo.

Posso gerar um script de cleanup separado se quiser — me avisa.

## ⚠️ Credenciais ainda expostas

Lembrete: o `META_SYNC_SECRET` e outras credenciais expostas em conversas recentes **ainda precisam ser rotacionados**. Nada nesses patches mexe nisso, mas é importante não esquecer.
