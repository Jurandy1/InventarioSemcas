# Inventário SEMCAS

Sistema de inventário patrimonial da Secretaria Municipal — SEMCAS.

## Stack

- **Frontend:** React 18 + Vite
- **Dados:** Supabase (com autenticação Firebase Identity)
- **Storage:** Firebase Storage (fotos)
- **Offline:** IndexedDB + fila de sincronização

## Estrutura do projeto

```
src/
├── app/                    # Entradas da aplicação
│   ├── App.jsx             # Ponto de entrada (config + render)
│   ├── OrganizedApp.jsx    # Conecta hook à view
│   ├── lazyPages.jsx       # Imports lazy das abas
│   ├── admin/              # Abas administrativas
│   ├── coord/              # Fluxo da coordenadora
│   ├── inventariante/      # Registro por convite
│   ├── helpers/            # Funções auxiliares do app
│   ├── hooks/
│   │   ├── useOrganizedApp.jsx   # Orquestrador
│   │   ├── useAppState.js        # Estado e formulário
│   │   ├── useAppData.js         # Dados, auth e derivados
│   │   ├── useAppSync.jsx        # Sync em tempo real
│   │   ├── useAppCamera.js       # Câmera e retomada de sessão
│   │   └── useAppItemActions.js  # CRUD de itens e finalização
│   └── components/
│       └── AppMainView.jsx      # Layout, abas e modais
├── components/             # Componentes reutilizáveis
│   └── modals/             # Modais da interface
├── constants/              # Constantes e configurações
├── data/                   # Dados estáticos (JSON)
├── hooks/                  # Hooks React customizados
├── pages/                  # Abas lazy-loaded
├── services/               # Integrações (Firebase, Supabase, etc.)
├── styles/                 # CSS global
└── utils/                  # Funções utilitárias

scripts/                    # Migração, testes e SQL do banco
public/                     # Assets estáticos (planilha XLSX)
```

## Scripts

```bash
npm run dev       # Servidor de desenvolvimento
npm run build     # Build de produção
npm run preview   # Preview do build
npm run migrate   # Migração de dados
```

## Variáveis de ambiente

Crie um `.env` na raiz:

```
VITE_FB_API_KEY=
VITE_FB_PROJECT_ID=
VITE_FB_STORAGE_BUCKET=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Deploy

- **Vercel:** configurado via `vercel.json`
- **GitHub Pages:** workflow em `.github/workflows/pages.yml`
