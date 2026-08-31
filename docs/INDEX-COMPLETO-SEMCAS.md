# Inventário Patrimonial SEMCAS — Índice Completo de UI

> **Documento de referência fiel ao app atual** (React 18 + Vite, Supabase, Firebase, design gov.br).  
> Use este arquivo para pedir melhorias de design **sem perder menus, estrutura ou funcionalidades**.

**Arquivo:** `docs/INDEX-COMPLETO-SEMCAS.md`  
**Projeto:** `InventarioSemcas-main`

---

## Prompt sugerido para IA de design

```
Redesenhe o app Inventário Patrimonial SEMCAS com base no INDEX-COMPLETO-SEMCAS.md.

REGRAS OBRIGATÓRIAS:
- Manter TODOS os menus, sub-abas, modais, filtros, botões e exports listados
- Manter as 3 personas: admin, inventariante, coordenadora
- Manter layout Desktop (sidebar) e Mobile (bottom nav) com as mesmas funcionalidades
- Melhorar hierarquia visual, espaçamento, tipografia e consistência
- Não remover nenhuma ferramenta ou fluxo
```

---

# PARTE 1 — DESIGN SYSTEM

## 1.1 Cores (CSS variables — `src/styles/global.css`)

| Token | Hex | Uso |
|-------|-----|-----|
| `--gov-primary` | `#1351B4` | Header, botões primários, nav ativa |
| `--gov-primary-dark` | `#0C326F` | Títulos H1/H2, hover |
| `--gov-primary-light` | `#E8F0FE` | Nav ativa bg, alertas info |
| `--gov-accent` | `#168821` | Sucesso, faixa verde do header |
| `--gov-accent-light` | `#E3F5E8` | Alertas success |
| `--gov-warning` | `#FFCD07` | Faixa amarela do header |
| `--gov-danger` | `#E52207` | Erros, badges vermelhos |
| `--gov-danger-light` | `#FDE8E8` | Alertas danger |
| `--gov-bg` | `#F0F2F5` | Fundo da página |
| `--gov-surface` | `#FFFFFF` | Cards, modais, sidebar |
| `--gov-border` | `#CCCCCC` | Bordas |
| `--gov-border-light` | `#E5E5E5` | Bordas suaves |
| `--gov-text` | `#333333` | Texto principal |
| `--gov-text-secondary` | `#555555` | Texto secundário |
| `--gov-text-muted` | `#888888` | Labels, hints |

## 1.2 Tipografia

- **Fonte:** `"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **H1:** clamp(22px → 28px), peso 700, cor `--gov-primary-dark`
- **H2:** clamp(18px → 22px), peso 700
- **H3:** clamp(16px → 18px), peso 700
- **Line-height:** 1.5

## 1.3 Espaçamento e forma

| Propriedade | Valor |
|-------------|-------|
| Border radius | `4px` (`--gov-radius`) |
| Sombra leve | `--gov-shadow-sm` |
| Sombra média | `--gov-shadow-md` |
| Touch target mínimo | `44px` (botões) |
| Input tombo (mobile) | `48px` altura |

## 1.4 Componentes CSS (classes gov-*)

| Classe | Função |
|--------|--------|
| `gov-header` | Barra superior azul sticky (z-index 200) |
| `gov-header__flag` | Faixa verde/amarelo/azul 4px no topo |
| `gov-sidebar` | Menu lateral 220px (só desktop) |
| `gov-bottom-nav` | Menu inferior fixo (só mobile) |
| `gov-nav-item` | Item do menu lateral |
| `gov-main` / `gov-main--mobile` | Área de conteúdo |
| `gov-card` | Card branco com borda |
| `gov-btn` | Botão base (min-height 44px) |
| `gov-btn--primary` | Botão azul preenchido |
| `gov-btn--secondary` | Botão com borda |
| `gov-btn--ghost` | Botão transparente (header) |
| `gov-alert` | Alerta (--danger, --warning, --info, --success) |
| `gov-tag` | Tag/chip |
| `gov-status-badge` | Badge de status |
| `gov-banner` | Banner informativo |
| `gov-toast` | Notificação flutuante |
| `gov-modal-overlay` | Fundo escuro do modal |
| `gov-modal-panel` | Painel do modal |
| `gov-auth-page` | Página de login/cadastro |
| `gov-auth-card` | Card centralizado (max 440px) |
| `gov-loading` + `gov-spinner` | Estado de carregamento |

## 1.5 Breakpoints

| Breakpoint | Comportamento |
|------------|---------------|
| **≤767px** (mobile) | Bottom nav, modais bottom-sheet, padding 12px, labels abreviados |
| **≥768px** (desktop) | Sidebar 220px, modais centralizados (min 420px), padding 24px |
| **≤480px** | Inputs 16px (evita zoom automático no iOS) |

---

# PARTE 2 — ESTRUTURA GERAL (SHELL)

## 2.1 Layout DESKTOP (≥768px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← faixa verde/amarelo/azul
│ [S] SEMCAS — Inventário Patrimonial    Usuário · Unidade   [Atualizar] [Sair] │  ← gov-header (#1351B4)
├──────────────┬──────────────────────────────────────────────────────────┤
│ SIDEBAR 220px│  MAIN (padding 24px, bg #F0F2F5)                          │
│              │                                                          │
│ 📋 Inventário│  [Banner campanha fechada — se aplicável]                │
│ 📁 Finalizados│  [Banner upload fotos — se aplicável]                   │
│ 🔍 Busca     │                                                          │
│ 📦 Itens     │  ┌────────────────────────────────────────────────────┐  │
│ 📄 Notas     │  │ gov-card — CONTEÚDO DA ABA ATIVA                 │  │
│ 🏷️ Tombos    │  │  H1 título + filtros + botões + cards/tabelas      │  │
│ 📊 Dashboard │  └────────────────────────────────────────────────────┘  │
│ 🛡️ Coord.*   │                                                          │
│ ✏️ Nomes*    │                                                          │
│ 👥 Invit.*   │                                                          │
│              │                                                          │
│ ──────────── │                                                          │
│ Status fotos │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘

* Coordenadores, Nomes = admin + inventariante
* Inventariantes = só admin
```

## 2.2 Layout MOBILE (≤767px)

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← faixa cores
│ [S] SEMCAS          Usuário  [↻][Sair] │  ← header compacto
├─────────────────────────────────────┤
│                                     │
│  MAIN (padding 12px)                │
│  safe-area bottom: 78px             │
│                                     │
│  [Banners]                          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Conteúdo 1 coluna           │    │
│  │ Touch targets 44–48px       │    │
│  │ Chips horizontais           │    │
│  │ Cards grid 2 colunas        │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│ Inv.│Fin.│Busca│Itens│NF│Tomb.│Dash │  ← gov-bottom-nav (fixo)
└─────────────────────────────────────┘

Modais: bottom-sheet (sobe de baixo, largura total)
Toasts: acima da bottom nav
```

## 2.3 Header global (todas as telas logadas)

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Logo | Selo "S" + "Secretaria Municipal — SEMCAS" + "Inventário Patrimonial" | Versão compacta |
| Meta | Nome do usuário · unidade(s) ativa(s) | Abreviado |
| Status | Fila offline/sync de fotos | Igual |
| Atualizar base | Texto completo | Ícone ↻ apenas |
| Sair | Botão ghost | Botão ghost |

---

# PARTE 3 — ROTAS E AUTENTICAÇÃO

| Rota | Tela | Campos / Ações |
|------|------|----------------|
| `/` | **LoginPage** | E-mail, senha, botão Entrar, link "Cadastro com convite" |
| `#/invregistro/:token` | **InventarianteRegistro** | Nome*, matrícula*, cargo, e-mail*, senha*, confirmar senha*, Criar conta |
| `#/coord/` | **CoordinadorLogin** | E-mail, senha, Entrar → CoordinadorPage |
| `#/coordregistro/:token` | **CoordinadorRegistro** | Nome*, matrícula*, e-mail*, senha*, Registrar |

**Estados de cadastro:** loading → formulário → sucesso → erro

---

# PARTE 4 — MENU PRINCIPAL (10 abas)

| ID | Label Desktop | Label Mobile | Badge | Ícone | Visível para |
|----|---------------|--------------|-------|-------|--------------|
| `inventario` | Inventário | Inv. | Unidades ativas | Prancheta | Todos |
| `finalizados` | Finalizados | Fin. | Qtd finalizações | Pasta c/ check | Todos |
| `busca` | Busca | Busca | — | Lupa | Todos |
| `itens` | Itens | Itens | — | Caixa 3D | Todos |
| `nf` | Notas | NF | — | Documento | Todos |
| `tombos` | Tombos | Tomb. | Duplicados | Etiqueta | Todos |
| `dash` | Dashboard | Dash | — | Gráfico barras | Todos |
| `coordenadores` | Coordenadores | Coord. | — | Escudo | Admin + Inventariante |
| `correcao` | Nomes | Nomes | — | Lápis | Admin + Inventariante |
| `inventariantes` | Inventariantes | Invit. | — | Pessoas | Só Admin |

---

# PARTE 5 — PÁGINAS DETALHADAS

---

## 5.1 InventarioPage

**Arquivo:** `src/pages/InventarioPage.jsx`  
**Sub-abas:** Inventariar | Em Andamento | Locais | Ajuste | Resumo

### Sub-aba: INVENTARIAR

| Seção | Elementos |
|-------|-----------|
| Filtros | Campo "Buscar unidade...", checkbox "Ocultar itens Incorporados" |
| Grid unidades | Cards com barra de progresso, status finalização, checkbox seleção |
| Sessões pausadas | Lista com botões Retomar / Cancelar |
| Barra fixa (sticky) | Limpar · Iniciar / Adicionar / Novo inventário |
| Modal | `cancelar-inventario` |

**Desktop:** grid multi-coluna de cards  
**Mobile:** 1 coluna, barra sticky no rodapé

---

### Sub-aba: EM ANDAMENTO

| Seção | Elementos |
|-------|-----------|
| Barra tombo | Campo "DIGITAR TOMBO" + botões Abrir + Encontrei |
| Contexto | Sala fixada, resumo da sessão, presença da equipe |
| Unidade | Mini-cards da unidade + lista "Salas da unidade" |
| Filtros | Busca, "Ocultar já encontrados", "Ocultar Incorporados" |
| Modos de vista | Padrão · Agrupar por Categoria · Últimos coletados |
| Lista de itens | Card com foto, badges, bloco permuta; ações: Encontrei, Excluir, Reconciliar Tombo |
| Ações globais | Próximo pendente · Manual · + Vários iguais · Finalizar · Pausar · Cancelar |
| Admin only | Convidar colega |
| Paginação | Anterior / Próxima |
| Modais | detalhe, manual, semTombo, multi, finalizar, camera, ajusteLink, LocalDetail, convite-inventariante, qrcode-resultado, ImageOverlay, save-conflict |

**Desktop:** todas vistas visíveis, tombo input 48px, grids multi-coluna  
**Mobile:** 1 coluna, "Mais vistas" colapsado quando sala fixada, botões 2 colunas flex

---

### Sub-aba: LOCAIS

| Modo | Elementos |
|------|-----------|
| Lista | Quick-add sala, cards de local (contagem itens, Remover) |
| Detalhe | Voltar, Sem tombo, Manual, busca pendentes, itens alocados com Vincular tombo / Abrir / Excluir |
| Modais | detalhe, manual, semTombo, ajusteLink |

---

### Sub-aba: AJUSTE

| Elemento | Descrição |
|----------|-----------|
| AjusteWorkbench | Itens sem tombo, vincular a tombo da planilha, fotos em lote |
| Modais | semTombo, ajusteLink |

---

### Sub-aba: RESUMO

| Elemento | Descrição |
|----------|-----------|
| Agrupamento | Por local |
| Campos | Foto, descrição, NF, data de coleta |
| Tipo | Somente leitura |

---

## 5.2 FinalizadosPage

**Arquivo:** `src/pages/FinalizadosPage.jsx`

### Modo LISTA

| Elemento | Descrição |
|----------|-----------|
| Título | "Inventários finalizados" |
| Filtro | Buscar unidade ou coordenadora |
| Botões | Relatório completo · Atualizar |
| Cards | Nome unidade, data, coordenadora, barra stats, "Editar inventário" |
| Modal | RelatorioCompletoModal |

### Modo EDIÇÃO (por finalização)

| Sub-abas | Itens · Locais · Não encontrados · Tombos divergentes · Ligação mobiliário · Resumo |
|----------|---|
| Header | + Adicionar item · + Foto sem tombo · ← Voltar à lista |
| Filtros Itens | Busca, ocultar encontrados, ocultar incorporados, paginação |
| Filtros NE | Busca, ocultar incorporados |
| Divergentes | Manter aqui · Vincular à planilha · Editar |
| Modais | detalhe, manual, semTombo, ajusteLink, RelatorioCompleto, LocalDetail, camera, ImageOverlay |

**Permissão editar:** campanha aberta OU admin/inventariante

---

## 5.3 BuscaPage

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Campo busca | Global, min 2 chars, debounce 300ms | Igual |
| Resultados | Grid multi-coluna | 1 coluna |
| Ação no card | Abre ItemDetailModal + ativa unidade | Igual |
| Modais | detalhe, ImageOverlay | Igual |

---

## 5.4 ItensPage

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Categorias | Sidebar sticky à esquerda | Chips horizontais |
| Status | Chips: Todos / Só encontrados / Pendentes | Igual |
| Filtros | Busca (descrição, Nº, marca, NF), estado dropdown, unidade dropdown | Igual |
| Checkboxes | Só encontrados, Ocultar Incorporados | Igual |
| Botões | Preview · Relatório PDF | Igual |
| Cards | Foto em destaque | Grid 2 colunas |
| Paginação | 12 / 24 / 48 / 96 por página | Igual |
| Modais | detalhe, RelatorioFotosModal, ImageOverlay | Igual |

---

## 5.5 NotasFiscaisPage

| Elemento | Descrição |
|----------|-----------|
| Filtros | Busca NF/fornecedor + tipo (Todos / Próprio / Doação / Incorporado) |
| Cards NF | Resumo com barra de progresso + preview de 2 itens (VirtuosoGrid) |
| Modal inline | NF expandida com busca de itens → ItemDetailModal |
| Desktop | Filtros em 2 colunas, grid mais largo |
| Modais | detalhe (via NF), ImageOverlay |

---

## 5.6 TombosPage

| Sub-aba | Conteúdo |
|---------|----------|
| Não encontrados | Cards com borda vermelha (NE) |
| Duplicados / divergências | Cards com borda roxa |
| Paginação | 20 por página, Anterior / Próxima |
| Tipo | Somente leitura, sem modais |

---

## 5.7 DashboardPage

| Seção | Elementos |
|-------|-----------|
| Campanha | Card Fechar/Reabrir inventário (admin only) |
| Stats | Total · Encontrados · Pendentes · Progresso |
| Exportar | PDF · Excel · Relatório completo · Backup |
| Atividade | Últimos a inventariar (por usuário) |
| Alertas | XLSX corrompidos → botão Ver (vai para Inventário) |
| Gráfico | Estado de Conservação (barras por estado) |
| Modal | RelatorioCompletoModal |
| Desktop | Stats em 4 colunas |
| Mobile | Stats grid 2×2 |

---

## 5.8 CorrecaoNomesPage (aba "Nomes")

**Arquivo:** `src/pages/CorrecaoNomesPage.jsx`  
**Visível:** admin + inventariante

| Modo | Padronizar · Corrigidos · Em lote |
|------|---|
| Filtros | Unidade, espécie, query texto, tipo problema (abreviação, MAIÚSCULAS, sem foto, sem espécie, baixa qualidade), toggle "Incluir itens do tombo" |
| Por item | Checkbox, botão Auto, botão IA (Gemini) |
| Lote | Selecionar tudo, aplicar nome, padronizar lote, diálogo confirmar |
| Componentes | CorrecaoStats, PadronizacaoLoteCard, NomeDiff, AtributoChips |
| Desktop | 30 itens/página |
| Mobile | 15 itens/página + barra de ações fixa ao selecionar |
| Modais | detalhe (foto), ImageOverlay |

---

## 5.9 CoordenadoresTab

**Arquivo:** `src/app/admin/CoordenadoresTab.jsx`  
**Visível:** admin + inventariante

| Sub-abas | Pendentes · Aprovadas · Rejeitadas |
|----------|---|
| Botão | + Gerar Convite |
| Card ações | Aprovar · Rejeitar · Desativar |
| Modal convite | Selecionar unidade + matrícula → copiar link |
| Modais | Aprovar, Rejeitar, Desativar, Gerar Novo Convite |

---

## 5.10 InventariantesTab

**Arquivo:** `src/app/admin/InventariantesTab.jsx`  
**Visível:** só admin

| Sub-abas | Pendentes · Aprovados · Rejeitados · Desativados |
|----------|---|
| Botão | Gerar Convite (link 7 dias) |
| Card ações | Aprovar · Rejeitar · Desativar · Reativar |
| Avisos | Duplicidade de matrícula/e-mail nos cards |
| Modais | Convite, Aprovar, Rejeitar, Desativar |

---

## 5.11 CoordinadorPage (portal externo)

**Rota:** `#/coord/`  
**Arquivo:** `src/app/coord/CoordinadorPage.jsx`  
**Header próprio:** nome coord, unidade(s), fila offline + Sync, Sair

### Aba: Meu Inventário

| Elemento | Descrição |
|----------|-----------|
| Stats | Localizados · Com foto · Locais |
| Filtros | Chips de estado (clicáveis), busca, dropdowns Local / Situação / Fotos |
| Opção | Agrupar por local |
| Cards | Item com badge "Verificar" para itens cadastrados por inventariante |
| Botões | Limpar filtros · Carregar mais |
| Oculto | Situação "Permuta" aparece como "Em uso" |

### Aba: Relatório

| Elemento | Descrição |
|----------|-----------|
| Botões | Exportar Excel · Fechar inventário (se campanha aberta) |
| Stats | Localizados, Com foto, Aguardando verificação, Locais |
| Gráfico | Barras de conservação |
| Modais | Detalhe inline (não ItemDetailModal), CameraModal, ImageOverlay |

**Desktop:** stats/filtros 4 colunas  
**Mobile:** stats/filtros 2 colunas

---

# PARTE 6 — MODAIS (17 tipos)

| Chave | Componente | Função | Campos / Ações principais |
|-------|----------|--------|---------------------------|
| `camera` | CameraModal | Tirar foto | Live camera ou captura nativa; Cancelar, Flash, Galeria, Capturar, Trocar câmera, Refazer, Usar foto, Concluir (N fotos) |
| `detalhe` | ItemDetailModal | Editar item | Meta, alerta sem tombo, descrição, fotos, local, origem, marca, IMEI, estado (grid), situação (chips), permuta, cor, plaqueta ausente, obs, histórico; Fechar, Tirar foto, Remover foto, Reatribuir tombo, Converter sem tombo, Excluir, Salvar |
| `manual` | ManualModal | Item manual | Patrimônio, descrição, espécie, estado, situação, origem/doação, cor, local, qtd, fotos, IMEI, hint tombo, Salvar |
| `semTombo` | SemTomboModal | Sem tombo | Modos novo/pendentes; local, descrição, estado, obs, marca, origem, cor, fotos, checklist pendente |
| `multi` | MultiItemModal | Vários iguais | Campos compartilhados + por linha: tombo, estado, obs, cor, fotos |
| `addLocal` | AddLocalModal | Novo local | Nome do local |
| `finalizar` | FinalizarModal | Finalizar | Stats, nome/matrícula coord; Gerar link e QR Code |
| `qrcode-resultado` | Overlay inline | Pós-finalizar | QR Code + link coordenadora |
| `convite-inventariante` | Overlay inline | Convidar colega | Admin only |
| `cancelar-inventario` | Overlay inline | Cancelar sessão | Confirmação |
| `ajusteLink` | AjusteLinkModal | Vincular tombo | Busca tombos ranqueados, ação vincular |
| `relatorio-fotos` | RelatorioFotosModal | PDF fotos | Abas Categorias + Itens; Preview / PDF |
| `relatorio-completo` | RelatorioCompletoModal | Relatório finalizados | Seleção unidade (uma ou todas); Excel / PDF sem foto / PDF com foto |
| `local-detail` | LocalDetailModal | Detalhe sala | Lista itens com fotos; + Manual, + Sem tombo |
| `image-overlay` | ImageOverlay | Zoom foto | Tela cheia, botão Fechar (z-index 500) |
| `save-conflict` | Overlay inline | Conflito edição | Edição simultânea |
| `busy` | Overlay inline | Processando | Overlay global de loading |

### Comportamento modal por dispositivo

| | Desktop | Mobile |
|---|---------|--------|
| Posição | Centralizado, min-width 420px | Bottom sheet (sobe de baixo) |
| Largura | Limitada | 100% da tela |
| Overlay | Fundo escuro semi-transparente | Igual |

---

# PARTE 7 — FERRAMENTAS E EXPORTS

| Ferramenta | Onde aparece | O que faz |
|------------|--------------|-----------|
| Atualizar base | Header | Recarrega planilha XLSX de patrimônio |
| Sair | Header | Logout Firebase |
| Status offline/sync | Header | Mostra fila de upload e sincronização |
| Exportar PDF | Dashboard | Relatório geral em PDF |
| Exportar Excel | Dashboard | Planilha geral |
| Backup | Dashboard | Backup completo dos dados |
| Relatório completo | Dashboard + Finalizados | Unidade ou todas; Excel, PDF sem/com foto |
| Preview / Relatório PDF fotos | Itens | Por categoria ou itens selecionados |
| Fechar/Reabrir campanha | Dashboard (admin) | Bloqueia novos inventários globalmente |
| Gemini IA nome | Nomes | Sugestão automática de descrição |
| Convite inventariante | Inventariantes | Gera link 7 dias |
| Convite coordenadora | Coordenadores | Link com unidade + matrícula |
| Convidar colega | Inventário Em Andamento | Admin only |
| QR Code coord | Finalizar | Link portal coordenadora |
| Busca global | Busca | Todos os itens de todas unidades |
| MiniSearch | Itens, Finalizados, NF | Busca local na página |
| Paginação | Várias páginas | Controle de itens por página |
| VirtuosoGrid | Notas Fiscais | Grid virtualizado para performance |
| ToastNotification | Global | Feedback de ações |
| Campanha fechada banner | Global | Banner vermelho quando campanha fechada |

---

# PARTE 8 — MATRIZ MODAIS × TELAS

| Tela | Modais que abre |
|------|-----------------|
| InventarioPage | detalhe, manual, semTombo, multi, finalizar, cancelar, ajusteLink, camera, LocalDetail, convite, qrcode, ImageOverlay, save-conflict |
| FinalizadosPage | detalhe, manual, semTombo, ajusteLink, RelatorioCompleto, LocalDetail, camera, ImageOverlay |
| BuscaPage | detalhe, ImageOverlay |
| ItensPage | detalhe, RelatorioFotos, ImageOverlay |
| NotasFiscaisPage | detalhe (via NF), ImageOverlay |
| DashboardPage | RelatorioCompleto |
| CorrecaoNomesPage | detalhe, ImageOverlay |
| CoordenadoresTab | aprovar, rejeitar, desativar, novoconvite |
| InventariantesTab | convite, aprovar, rejeitar, desativar |
| CoordinadorPage | detalhe inline, camera, ImageOverlay |

---

# PARTE 9 — PERMISSÕES POR PERSONA

## Admin
- Todas as 10 abas do menu (inclui Inventariantes)
- Fechar/reabrir campanha de inventário
- Convidar colega no inventário em andamento
- Editar finalizados mesmo com campanha fechada

## Inventariante (aprovado)
- 9 abas (sem Inventariantes)
- Coordenadores + Nomes (correção)
- Editar finalizados com campanha fechada
- Não pode fechar campanha nem convidar colega

## Coordenadora (app separado /coord)
- Portal próprio: Meu Inventário + Relatório
- Não vê situação "Permuta" (mostra "Em uso")
- Pode exportar Excel e fechar inventário da sua unidade

## Campanha fechada (global)
- Banner vermelho em todas as telas
- Bloqueia novos registros no Inventário
- Finalizados editáveis só para admin + inventariante

---

# PARTE 10 — COMPARAÇÃO DESKTOP vs MOBILE

| Área | Desktop (≥768px) | Mobile (≤767px) |
|------|------------------|-----------------|
| Navegação | Sidebar 220px, labels completos | Bottom nav fixa, labels abreviados |
| Conteúdo | padding 24px | padding 12px + safe-area 78px |
| Header | "Atualizar base" com texto | Ícone ↻ apenas |
| Modais | Centralizado, min 420px | Bottom sheet, largura total |
| Toasts | bottom 24px | Acima da bottom nav |
| Inventário | Grids multi-coluna, todas vistas | 1 coluna, "Mais vistas" colapsado |
| Itens | Sidebar categorias sticky | Chips + grid 2 colunas |
| Correção nomes | 30 itens/página | 15 itens/página + barra fixa |
| Formulários | inputs 14px | inputs 16px (≤480px, sem zoom iOS) |
| Coord portal | 4 col stats/filtros | 2 col stats/filtros |
| Touch | Botões min 44px | Botões 44–48px, tombo bar 48px |
| Performance | Limites maiores por página | `content-visibility: auto` no main |

---

# PARTE 11 — MAPA DE ARQUIVOS (referência técnica)

```
src/
├── pages/
│   ├── LoginPage.jsx
│   ├── InventarioPage.jsx
│   ├── FinalizadosPage.jsx
│   ├── BuscaPage.jsx
│   ├── ItensPage.jsx
│   ├── NotasFiscaisPage.jsx
│   ├── TombosPage.jsx
│   ├── DashboardPage.jsx
│   └── CorrecaoNomesPage.jsx
├── app/
│   ├── admin/
│   │   ├── CoordenadoresTab.jsx
│   │   └── InventariantesTab.jsx
│   ├── coord/
│   │   ├── CoordinadorLogin.jsx
│   │   ├── CoordinadorRegistro.jsx
│   │   ├── CoordinadorPage.jsx
│   │   └── InventarianteRegistro.jsx
│   └── components/
│       └── AppMainView.jsx          ← orquestra modais e páginas
├── components/
│   ├── NavBar.jsx                   ← header + sidebar + bottom nav
│   ├── ItemDetailModal.jsx
│   ├── CameraModal.jsx
│   ├── Overlay.jsx
│   ├── AjusteWorkbench.jsx
│   ├── LocaisWorkspace.jsx
│   ├── ToastNotification.jsx
│   └── modals/
│       ├── ManualModal.jsx
│       ├── SemTomboModal.jsx
│       ├── MultiItemModal.jsx
│       ├── AddLocalModal.jsx
│       ├── FinalizarModal.jsx
│       ├── AjusteLinkModal.jsx
│       ├── LocalDetailModal.jsx
│       ├── RelatorioFotosModal.jsx
│       └── RelatorioCompletoModal.jsx
└── styles/
    └── global.css                   ← design system gov.br
```

---

# PARTE 12 — CHECKLIST PARA REDESIGN (não esquecer)

- [ ] Header com faixa verde/amarelo/azul e logo SEMCAS
- [ ] 10 itens de menu (com badges dinâmicos)
- [ ] Sidebar desktop + bottom nav mobile
- [ ] 5 sub-abas do Inventário
- [ ] 6 sub-abas do modo edição em Finalizados
- [ ] 17 modais listados na Parte 6
- [ ] 4 telas de autenticação/cadastro
- [ ] Portal coordenadora separado (/coord)
- [ ] Todos os exports (PDF, Excel, Backup, Relatórios)
- [ ] Filtros de cada página preservados
- [ ] Permissões admin / inventariante / coordenadora
- [ ] Banner campanha fechada
- [ ] Status offline e upload de fotos
- [ ] Touch targets mínimos 44px no mobile
- [ ] Bottom sheet modais no mobile
- [ ] Inputs 16px no mobile (sem zoom iOS)

---

*Documento gerado como referência completa do app Inventário Patrimonial SEMCAS.  
Última atualização: agosto/2026.*
