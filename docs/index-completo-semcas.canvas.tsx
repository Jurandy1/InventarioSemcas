import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleSection,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
  Swatch,
  Table,
  Text,
  Toggle,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type LayoutMode = "desktop" | "mobile";

const NAV_ITEMS = [
  { id: "inventario", label: "Inventário", mobile: "Inv.", badge: "unidades ativas", roles: "todos" },
  { id: "finalizados", label: "Finalizados", mobile: "Fin.", badge: "qtd finalizações", roles: "todos" },
  { id: "busca", label: "Busca", mobile: "Busca", badge: null, roles: "todos" },
  { id: "itens", label: "Itens", mobile: "Itens", badge: null, roles: "todos" },
  { id: "nf", label: "Notas", mobile: "NF", badge: null, roles: "todos" },
  { id: "tombos", label: "Tombos", mobile: "Tomb.", badge: "duplicados", roles: "todos" },
  { id: "dash", label: "Dashboard", mobile: "Dash", badge: null, roles: "todos" },
  { id: "coordenadores", label: "Coordenadores", mobile: "Coord.", badge: null, roles: "admin + inventariante" },
  { id: "correcao", label: "Nomes", mobile: "Nomes", badge: null, roles: "admin + inventariante" },
  { id: "inventariantes", label: "Inventariantes", mobile: "Invit.", badge: null, roles: "admin" },
];

const DESIGN_TOKENS = [
  ["--gov-primary", "#1351B4", "Ações primárias, nav ativa, header"],
  ["--gov-primary-dark", "#0C326F", "Títulos, hover"],
  ["--gov-primary-light", "#E8F0FE", "Nav ativa bg, alertas info"],
  ["--gov-accent", "#168821", "Sucesso, faixa verde"],
  ["--gov-warning", "#FFCD07", "Faixa amarela"],
  ["--gov-danger", "#E52207", "Erros, badges"],
  ["--gov-bg", "#F0F2F5", "Fundo da página"],
  ["--gov-surface", "#FFFFFF", "Cards, modais"],
  ["--gov-border", "#CCCCCC", "Bordas"],
  ["--gov-text", "#333333", "Texto principal"],
  ["--gov-muted", "#888888", "Texto secundário"],
];

const MODALS = [
  ["camera", "CameraModal", "Tirar foto (câmera nativa ou live)"],
  ["detalhe", "ItemDetailModal", "Edição completa do item patrimonial"],
  ["manual", "ManualModal", "Adicionar item manual com tombo"],
  ["semTombo", "SemTomboModal", "Foto sem tombo / mesma foto em vários"],
  ["multi", "MultiItemModal", "Vários itens iguais de uma vez"],
  ["addLocal", "AddLocalModal", "Criar novo local/sala"],
  ["finalizar", "FinalizarModal", "Finalizar inventário + QR/link coord"],
  ["qrcode-resultado", "Overlay inline", "QR Code e link após finalizar"],
  ["convite-inventariante", "Overlay inline", "Convidar colega (admin)"],
  ["cancelar-inventario", "Overlay inline", "Confirmar cancelamento de sessão"],
  ["ajusteLink", "AjusteLinkModal", "Vincular item sem tombo a tombo da planilha"],
  ["relatorio-fotos", "RelatorioFotosModal", "PDF/Preview por categoria ou item"],
  ["relatorio-completo", "RelatorioCompletoModal", "Excel/PDF unidades finalizadas"],
  ["local-detail", "LocalDetailModal", "Itens de um local + manual/sem tombo"],
  ["image-overlay", "ImageOverlay", "Zoom de foto em tela cheia"],
  ["save-conflict", "Overlay inline", "Conflito de edição simultânea"],
  ["busy", "Overlay inline", "Processamento global"],
];

const GLOBAL_TOOLS = [
  ["Atualizar base", "Header", "Recarrega planilha XLSX"],
  ["Sair", "Header", "Logout Firebase"],
  ["Status offline/sync", "Header", "Fila de upload e sincronização"],
  ["Exportar PDF", "Dashboard", "Relatório geral"],
  ["Exportar Excel", "Dashboard", "Planilha geral"],
  ["Backup", "Dashboard", "Backup completo dos dados"],
  ["Relatório completo", "Dashboard + Finalizados", "Unidade ou todas, Excel/PDF"],
  ["Preview / Relatório PDF fotos", "Itens", "Por categoria ou item selecionado"],
  ["Fechar/Reabrir campanha", "Dashboard (admin)", "Bloqueia novos inventários"],
  ["Gemini IA nome", "Nomes", "Sugestão automática de descrição"],
  ["Convite inventariante", "Inventariantes", "Link 7 dias"],
  ["Convite coordenadora", "Coordenadores", "Link com unidade + matrícula"],
  ["Convidar colega", "Inventário Em Andamento", "Admin apenas"],
  ["QR Code coord", "Finalizar", "Link para portal coordenadora"],
];

function WireBox({
  label,
  height,
  accent,
  children,
}: {
  label: string;
  height?: number;
  accent?: boolean;
  children?: unknown;
}) {
  const t = useHostTheme();
  return (
    <div
      style={{
        border: `1px solid ${t.stroke.secondary}`,
        background: accent ? t.accent.primary : t.fill.tertiary,
        color: accent ? t.text.onAccent : t.text.secondary,
        borderRadius: 4,
        padding: 8,
        minHeight: height ?? 32,
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: children ? 6 : 0 }}>{label}</div>
      {children}
    </div>
  );
}

function ShellWireframe({ mode }: { mode: LayoutMode }) {
  const t = useHostTheme();
  const isDesktop = mode === "desktop";

  if (isDesktop) {
    return (
      <Stack gap={8}>
        <WireBox label="gov-header (sticky, #1351B4)" height={56} accent>
          <Row gap={8} wrap>
            <Text size="small">Faixa verde/amarelo/azul</Text>
            <Spacer />
            <Text size="small">SEMCAS | Usuário · Unidade | Offline OK</Text>
            <Text size="small">[Atualizar base] [Sair]</Text>
          </Row>
        </WireBox>
        <Row gap={8} align="stretch" style={{ minHeight: 420 }}>
          <div style={{ width: 220, flexShrink: 0 }}>
            <WireBox label="gov-sidebar (220px)" height={400}>
              <Stack gap={4}>
                {NAV_ITEMS.map((n) => (
                  <div key={n.id}>
                    <Text size="small">
                      {n.label}
                      {n.badge ? ` (${n.badge})` : ""}
                    </Text>
                  </div>
                ))}
                <Divider />
                <Text size="small" tone="tertiary">
                  Status armazenamento fotos
                </Text>
              </Stack>
            </WireBox>
          </div>
          <div style={{ flex: 1 }}>
            <WireBox label="gov-main (padding 24px, bg #F0F2F5)" height={400}>
              <Stack gap={6}>
                <Text size="small">Banner campanha fechada (se aplicável)</Text>
                <Text size="small">Banner upload fotos (se aplicável)</Text>
                <WireBox label="gov-card — conteúdo da aba ativa" height={280}>
                  <Text size="small" tone="tertiary">
                    Título H1 + filtros + botões + cards/tabelas da página
                  </Text>
                </WireBox>
              </Stack>
            </WireBox>
          </div>
        </Row>
        <Text size="small" tone="tertiary">
          Desktop ≥768px — sidebar fixa à esquerda, modais centralizados (min 420px)
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={8}>
      <WireBox label="gov-header mobile" height={52} accent>
        <Row gap={6}>
          <Text size="small">S SEMCAS</Text>
          <Spacer />
          <Text size="small">Usuário</Text>
          <Text size="small">[↻] [Sair]</Text>
        </Row>
      </WireBox>
      <WireBox label="gov-main--mobile (padding 12px, safe-area bottom 78px)" height={360}>
        <Stack gap={6}>
          <Text size="small">Banners (campanha / upload)</Text>
          <WireBox label="Conteúdo da aba (1 coluna, touch 44–48px)" height={260}>
            <Text size="small" tone="tertiary">
              Botões empilhados, chips horizontais, cards em grid 2 colunas
            </Text>
          </WireBox>
        </Stack>
      </WireBox>
      <WireBox label="gov-bottom-nav (fixo, z-index 200)" height={56} accent>
        <Row gap={4} justify="space-between" wrap>
          {NAV_ITEMS.slice(0, 7).map((n) => (
            <div key={n.id}>
              <Text size="small">{n.mobile}</Text>
            </div>
          ))}
        </Row>
      </WireBox>
      <Text size="small" tone="tertiary">
        Mobile ≤767px — bottom sheet modais, toast acima da nav, inputs 16px (sem zoom iOS)
      </Text>
    </Stack>
  );
}

function PageWireframe({ title, mode, sections }: { title: string; mode: LayoutMode; sections: string[] }) {
  const isDesktop = mode === "desktop";
  return (
    <Card>
      <CardHeader trailing={<Pill tone="info">{isDesktop ? "Desktop" : "Mobile"}</Pill>}>{title}</CardHeader>
      <CardBody>
        <Stack gap={6}>
          {sections.map((s) => (
            <div key={s}>
              <WireBox label={s} height={isDesktop ? 36 : 44} />
            </div>
          ))}
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function IndexCompletoSemcas() {
  const [layout, setLayout] = useCanvasState<LayoutMode>("layout", "desktop");
  const t = useHostTheme();

  return (
    <Stack gap={20} style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <Stack gap={8}>
        <H1>Inventário Patrimonial SEMCAS — Índice Completo de UI</H1>
        <Text tone="secondary">
          Referência fiel ao app atual (React + Vite, design gov.br). Use este documento para pedir
          melhorias de design mantendo toda estrutura, menus, ferramentas e fluxos.
        </Text>
        <Callout tone="info">
          Prompt sugerido para IA: "Redesenhe o app SEMCAS com base neste índice. Mantenha TODOS os
          menus, sub-abas, modais, filtros, botões e exports. Melhore hierarquia visual, espaçamento e
          consistência mobile/desktop sem remover funcionalidades."
        </Callout>
        <Row gap={12} align="center">
          <Text weight="medium">Layout wireframe:</Text>
          <Toggle checked={layout === "mobile"} onChange={(v) => setLayout(v ? "mobile" : "desktop")} />
          <Text size="small">{layout === "desktop" ? "Desktop" : "Mobile"}</Text>
          <Button variant={layout === "desktop" ? "primary" : "ghost"} onClick={() => setLayout("desktop")}>
            Desktop
          </Button>
          <Button variant={layout === "mobile" ? "primary" : "ghost"} onClick={() => setLayout("mobile")}>
            Mobile
          </Button>
        </Row>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>1. Design System (global.css)</H2>
        <Grid columns={3} gap={12}>
          <Stat label="Fonte" value="Segoe UI, Roboto" />
          <Stat label="Raio" value="4px" />
          <Stat label="Touch min" value="44px" />
        </Grid>
        <Table
          headers={["Token CSS", "Hex atual", "Uso"]}
          rows={DESIGN_TOKENS.map((r) => r.map((c) => <Text size="small">{c}</Text>))}
        />
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader>Componentes gov</CardHeader>
            <CardBody>
              <Text size="small">
                gov-btn (primary/secondary/ghost), gov-card, gov-alert (danger/warning/info/success),
                gov-tag, gov-status-badge, gov-banner, gov-toast, gov-modal-overlay/panel, gov-auth-page,
                gov-loading, gov-spinner, gov-nav-item
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Breakpoints</CardHeader>
            <CardBody>
              <Text size="small">
                ≤767px: bottom nav, bottom sheet modais, padding 12px, labels abreviados
                <br />
                ≥768px: sidebar 220px, modais centralizados, padding 24px
                <br />
                ≤480px: inputs 16px (evita zoom iOS)
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>2. Shell do App — Wireframe {layout === "desktop" ? "Desktop" : "Mobile"}</H2>
        <Card>
          <CardBody>
            <ShellWireframe mode={layout} />
          </CardBody>
        </Card>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>3. Rotas e Autenticação</H2>
        <Table
          headers={["Rota", "Tela", "Elementos principais"]}
          rows={[
            ["/", "LoginPage", "E-mail, senha, Entrar, link convite inventariante"],
            ["#/invregistro/:token", "InventarianteRegistro", "Nome, matrícula, cargo, e-mail, senha, Criar conta"],
            ["#/coord/", "CoordinadorLogin", "E-mail, senha, Entrar → CoordinadorPage"],
            ["#/coordregistro/:token", "CoordinadorRegistro", "Nome, matrícula, e-mail, senha, Registrar"],
          ].map((r) => r.map((c) => <Text size="small">{c}</Text>))}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>4. Menu Principal (NavBar)</H2>
        <Table
          headers={["ID", "Desktop", "Mobile", "Badge", "Visível para"]}
          rows={NAV_ITEMS.map((n) => [
            <Text size="small">{n.id}</Text>,
            <Text size="small">{n.label}</Text>,
            <Text size="small">{n.mobile}</Text>,
            <Text size="small">{n.badge ?? "—"}</Text>,
            <Text size="small">{n.roles}</Text>,
          ])}
        />
        <Text size="small" tone="tertiary">
          Header global: logo SEMCAS, usuário, unidade ativa, status offline, Atualizar base, Sair
        </Text>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>5. Páginas — Inventário de telas ({layout})</H2>

        <CollapsibleSection title="InventarioPage" count={5} leading={<Swatch color="blue" />} defaultOpen>
          <Stack gap={10}>
            <PageWireframe
              title="Sub-aba: Inventariar"
              mode={layout}
              sections={[
                "Buscar unidade + checkbox Ocultar Incorporados",
                "Grid cards de unidades (progresso, checkbox seleção)",
                "Sessões pausadas: Retomar / Cancelar",
                "Barra fixa: Limpar | Iniciar / Adicionar / Novo inventário",
                "Modal: cancelar-inventario",
              ]}
            />
            <PageWireframe
              title="Sub-aba: Em Andamento"
              mode={layout}
              sections={[
                "Barra DIGITAR TOMBO + Abrir + Encontrei",
                "Sala fixada + resumo sessão + presença equipe",
                "Mini-cards unidade + Salas da unidade",
                "Filtros: busca, ocultar encontrados/incorporados, modos de vista",
                "Lista itens: Encontrei, Excluir, Reconciliar | Próximo, Manual, Vários iguais",
                "Admin: Convidar colega | Finalizar, Pausar, Cancelar",
                "Modais: detalhe, manual, semTombo, multi, finalizar, camera, ajusteLink, LocalDetail",
              ]}
            />
            <PageWireframe
              title="Sub-aba: Locais"
              mode={layout}
              sections={[
                "Quick-add sala + cards locais (contagem, Remover)",
                "Detalhe local: Sem tombo, Manual, busca pendentes, Vincular tombo",
              ]}
            />
            <PageWireframe
              title="Sub-aba: Ajuste"
              mode={layout}
              sections={["AjusteWorkbench: itens sem tombo, vincular tombo, fotos em lote"]}
            />
            <PageWireframe
              title="Sub-aba: Resumo"
              mode={layout}
              sections={["Agrupado por local: foto, descrição, NF, data coleta (somente leitura)"]}
            />
          </Stack>
        </CollapsibleSection>

        <CollapsibleSection title="FinalizadosPage" count={2} leading={<Swatch color="green" />}>
          <Stack gap={10}>
            <PageWireframe
              title="Lista de finalizados"
              mode={layout}
              sections={[
                "Buscar unidade/coordenadora",
                "Botões: Relatório completo, Atualizar",
                "Cards: unidade, data, coord, stats, Editar inventário",
              ]}
            />
            <PageWireframe
              title="Modo edição (por finalização)"
              mode={layout}
              sections={[
                "Sub-abas: Itens | Locais | Não encontrados | Tombos divergentes | Ligação mobiliário | Resumo",
                "Header: + Adicionar item, + Foto sem tombo, ← Voltar",
                "Filtros itens: busca, ocultar encontrados/incorporados, paginação",
                "Divergentes: Manter aqui, Vincular planilha, Editar",
              ]}
            />
          </Stack>
        </CollapsibleSection>

        <CollapsibleSection title="BuscaPage" leading={<Swatch color="purple" />}>
          <PageWireframe
            title="Busca global"
            mode={layout}
            sections={[
              "Campo busca (min 2 chars, debounce 300ms)",
              "Grid resultados → abre ItemDetailModal + ativa unidade",
              layout === "desktop" ? "Grid multi-coluna" : "Lista 1 coluna",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="ItensPage" leading={<Swatch color="orange" />}>
          <PageWireframe
            title="Catálogo de itens"
            mode={layout}
            sections={[
              layout === "desktop" ? "Sidebar categorias (sticky)" : "Chips categorias horizontais",
              "Filtros: status, busca, estado, unidade, só encontrados, ocultar incorporados",
              "Botões: Preview, Relatório PDF",
              "Cards com foto | paginação 12/24/48/96",
              "Modais: detalhe, RelatorioFotosModal, ImageOverlay",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="NotasFiscaisPage" leading={<Swatch color="yellow" />}>
          <PageWireframe
            title="Notas fiscais"
            mode={layout}
            sections={[
              "Filtro NF/fornecedor + tipo (Próprio/Doação/Incorporado)",
              "Cards NF com barra progresso + preview 2 itens (VirtuosoGrid)",
              "Modal inline NF expandida → ItemDetailModal",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="TombosPage" leading={<Swatch color="red" />}>
          <PageWireframe
            title="Tombos"
            mode={layout}
            sections={[
              "Sub-abas: Não encontrados | Duplicados/divergências",
              "Cards NE (borda vermelha) ou duplicado (roxo)",
              "Paginação 20/página — somente leitura",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="DashboardPage" leading={<Swatch color="blue" />}>
          <PageWireframe
            title="Dashboard"
            mode={layout}
            sections={[
              "Campanha: Fechar/Reabrir (admin)",
              "Stats: Total, Encontrados, Pendentes, Progresso",
              "Exportar: PDF, Excel, Relatório completo, Backup",
              "Últimos a inventariar + XLSX corrompidos + gráfico conservação",
              layout === "desktop" ? "Stats 4 colunas" : "Stats grid 2x2",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="CorrecaoNomesPage (Nomes)" leading={<Swatch color="purple" />}>
          <PageWireframe
            title="Correção de nomes"
            mode={layout}
            sections={[
              "Modos: Padronizar | Corrigidos | Em lote",
              "Filtros: unidade, espécie, query, problema, incluir tombo",
              "Por item: checkbox, Auto, IA Gemini",
              "Lote: selecionar tudo, aplicar, padronizar, confirmar",
              layout === "mobile" ? "Barra ações fixa ao selecionar" : "30 itens/página",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="CoordenadoresTab" leading={<Swatch color="green" />}>
          <PageWireframe
            title="Gestão coordenadoras"
            mode={layout}
            sections={[
              "Sub-abas: Pendentes | Aprovadas | Rejeitadas",
              "+ Gerar Convite (unidade + matrícula → copiar link)",
              "Cards: Aprovar, Rejeitar, Desativar",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="InventariantesTab (admin)" leading={<Swatch color="orange" />}>
          <PageWireframe
            title="Gestão inventariantes"
            mode={layout}
            sections={[
              "Sub-abas: Pendentes | Aprovados | Rejeitados | Desativados",
              "Gerar Convite (link 7 dias)",
              "Cards: Aprovar, Rejeitar, Desativar, Reativar + aviso duplicata",
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="CoordinadorPage (portal externo /coord)" leading={<Swatch color="blue" />}>
          <Stack gap={10}>
            <PageWireframe
              title="Aba: Meu Inventário"
              mode={layout}
              sections={[
                "Stats: Localizados, Com foto, Locais",
                "Chips estado + busca + dropdowns Local/Situação/Fotos",
                "Agrupar por local | cards item | badge Verificar",
              ]}
            />
            <PageWireframe
              title="Aba: Relatório"
              mode={layout}
              sections={[
                "Exportar Excel | Fechar inventário",
                "Stats + barras conservação",
                "Modais próprios: detalhe inline, camera, ImageOverlay",
              ]}
            />
          </Stack>
        </CollapsibleSection>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>6. Modais — Inventário completo</H2>
        <Table
          headers={["Chave", "Componente", "Função"]}
          rows={MODALS.map((r) => r.map((c) => <Text size="small">{c}</Text>))}
        />
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader>ItemDetailModal — campos</CardHeader>
            <CardBody>
              <Text size="small">
                Meta header, alerta sem tombo, dados editáveis, fotos, local, origem, marca, IMEI,
                grid estado, chips situação, permuta, cor, plaqueta ausente, observações, histórico.
                Ações: Fechar, Tirar foto, Remover foto, Reatribuir tombo, Converter sem tombo, Excluir,
                Salvar.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>CameraModal — controles</CardHeader>
            <CardBody>
              <Text size="small">
                Modos: câmera live ou captura nativa. Cancelar, Flash, Galeria, Capturar, Trocar câmera,
                Refazer, Usar foto, Concluir (N fotos). Mobile prefere captura nativa sem contexto seguro.
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>7. Ferramentas e exports globais</H2>
        <Table
          headers={["Ferramenta", "Onde", "Descrição"]}
          rows={GLOBAL_TOOLS.map((r) => r.map((c) => <Text size="small">{c}</Text>))}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>8. Matriz Modais × Telas</H2>
        <Table
          headers={["Tela", "Modais abertos"]}
          rows={[
            ["InventarioPage", "detalhe, manual, semTombo, multi, finalizar, cancelar, ajusteLink, camera, LocalDetail, convite, qrcode, ImageOverlay, conflito"],
            ["FinalizadosPage", "detalhe, manual, semTombo, ajusteLink, RelatorioCompleto, LocalDetail, camera, ImageOverlay"],
            ["BuscaPage", "detalhe, ImageOverlay"],
            ["ItensPage", "detalhe, RelatorioFotos, ImageOverlay"],
            ["NotasFiscaisPage", "detalhe (via NF), ImageOverlay"],
            ["DashboardPage", "RelatorioCompleto"],
            ["CorrecaoNomesPage", "detalhe, ImageOverlay"],
            ["CoordenadoresTab", "aprovar, rejeitar, desativar, novoconvite"],
            ["InventariantesTab", "convite, aprovar, rejeitar, desativar"],
            ["CoordinadorPage", "detalhe inline, camera, ImageOverlay"],
          ].map((r) => r.map((c) => <Text size="small">{c}</Text>))}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>9. Comparação Desktop vs Mobile</H2>
        <Table
          headers={["Área", "Desktop ≥768px", "Mobile ≤767px"]}
          rows={[
            ["Navegação", "Sidebar 220px labels completos", "Bottom nav labels abreviados"],
            ["Main", "padding 24px", "padding 12px + safe-area 78px"],
            ["Header", "Atualizar base (texto)", "Ícone ↻ apenas"],
            ["Modais", "Centralizado min 420px", "Bottom sheet largura total"],
            ["Toasts", "bottom 24px", "Acima bottom nav"],
            ["Inventário", "Grids multi-coluna, todas vistas", "1 coluna, Mais vistas colapsado"],
            ["Itens", "Sidebar categorias sticky", "Chips + grid 2 colunas"],
            ["Correção", "30 itens/página", "15 itens/página + barra fixa"],
            ["Forms", "inputs 14px", "inputs 16px (≤480px)"],
            ["Coord", "4 col stats/filtros", "2 col stats/filtros"],
          ].map((r) => r.map((c) => <Text size="small">{c}</Text>))}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>10. Regras de permissão (não remover no redesign)</H2>
        <Grid columns={3} gap={12}>
          <Card>
            <CardHeader>Admin</CardHeader>
            <CardBody>
              <Text size="small">
                Todas abas + Inventariantes. Fechar campanha. Convidar colega. Editar com campanha
                fechada.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Inventariante</CardHeader>
            <CardBody>
              <Text size="small">
                Todas exceto Inventariantes. Coordenadores + Nomes. Editar finalizados com campanha
                fechada.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Coordenadora</CardHeader>
            <CardBody>
              <Text size="small">
                App separado /coord: Meu Inventário + Relatório. Sem permuta (mostra Em uso).
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Callout tone="success">
        Este índice cobre 100% das telas, sub-abas, modais, filtros, botões e exports do código em
        src/pages, src/components, NavBar e AppMainView. Alterne Desktop/Mobile no topo para ver
        wireframes de cada modo.
      </Callout>
    </Stack>
  );
}
