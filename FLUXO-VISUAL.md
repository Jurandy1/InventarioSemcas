# 📸 FLUXO VISUAL - Registro de Coordenador

## 🎬 Cena 1: Admin gera convite

```
DASHBOARD ADMIN
┌─────────────────────────────────────────────────┐
│ 👩‍💼 Coordenadores                                  │
├─────────────────────────────────────────────────┤
│ ⏳ Pendentes (0)  ✅ Aprovadas (2)  ❌ Rejeitadas │
│                                                  │
│                     [+ Gerar Convite]            │
│                                                  │
│ Nenhuma coordenadora pendente                   │
│                                                  │
└─────────────────────────────────────────────────┘

Admin clica [+ Gerar Convite]

┌─────────────────────────────────────────────────┐
│ Gerar Novo Convite                      [x]     │
├─────────────────────────────────────────────────┤
│ Unidade * (required)                            │
│ ┌──────────────────────────────────────────┐    │
│ │ — Selecione uma unidade —                │    │
│ │ 01 - Prefeitura                          │ ▼  │
│ │ 02 - Secretaria de Educação              │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Matrícula (opcional)                            │
│ ┌──────────────────────────────────────────┐    │
│ │ Deixe em branco para preencher depois     │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│              [Cancelar] [🔗 Gerar]               │
└─────────────────────────────────────────────────┘

Admin seleciona "01 - Prefeitura", deixa matrícula em branco
Admin clica [🔗 Gerar]

┌─────────────────────────────────────────────────┐
│ Gerar Novo Convite                      [x]     │
├─────────────────────────────────────────────────┤
│                                                  │
│ ✓ Convite criado!                               │
│                                                  │
│ https://seu-site.com/#/coordregistro/conv_168   │
│ 1234567890_abc123def456ghi789jkl012             │
│                                                  │
│                  [📋 Copiar link]                │
│                                                  │
└─────────────────────────────────────────────────┘

Admin clica [📋 Copiar link] → Copied!
Admin envia via email para Maria Silva: maria@email.com
```

---

## 🎬 Cena 2: Coordenador se registra

```
Maria recebe email com link. Clica em:
https://seu-site.com/#/coordregistro/conv_1681234567890_abc123

PÁGINA DE REGISTRO ABRE:

┌─────────────────────────────────────────────────┐
│                  👩‍💼                               │
│        Registre-se como Coordenadora             │
│   Inventário SEMCAS · 01 - Prefeitura            │
├─────────────────────────────────────────────────┤
│                                                  │
│ Nome completo *                                  │
│ ┌──────────────────────────────────────────┐    │
│ │ Ex: Maria Silva                          │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Matrícula *                                      │
│ ┌──────────────────────────────────────────┐    │
│ │ 12345                                    │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Email *                                          │
│ ┌──────────────────────────────────────────┐    │
│ │ maria@email.com                          │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Senha *                                          │
│ ┌──────────────────────────────────────────┐    │
│ │ ••••••••                                 │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ Confirme a senha *                               │
│ ┌──────────────────────────────────────────┐    │
│ │ ••••••••                                 │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│         [✓ Registrar]                            │
│                                                  │
│ Após o registro, você precisará da aprovação    │
│ do administrador para acessar o sistema.        │
│                                                  │
└─────────────────────────────────────────────────┘

Maria preenche tudo corretamente e clica [✓ Registrar]

┌─────────────────────────────────────────────────┐
│                    ✅                             │
│             Registro concluído!                   │
│                                                  │
│ Bem-vinda, Maria Silva!                          │
│                                                  │
│ 📋 Sua solicitação foi enviada para aprovação.   │
│ O administrador analisará seus dados e você      │
│ receberá um email de confirmação.                │
│                                                  │
│              [Voltar]                            │
│                                                  │
└─────────────────────────────────────────────────┘

Maria vê confirmação. Status: PENDENTE_APROVACAO no banco.
```

---

## 🎬 Cena 3: Admin aprova

```
DASHBOARD ADMIN - Aba Coordenadores

Admin vê Maria em "⏳ Pendentes (1)"

┌─────────────────────────────────────────────────┐
│ Maria Silva                                      │
│ 📧 maria@email.com                               │
│ 🏛️ 01 - Prefeitura                              │
│ Matrícula: 12345                                │
│ 24/05/2025                            ⏳ Pendente│
│                                                  │
│ [✓ Aprovar]    [✕ Rejeitar]                     │
│                                                  │
└─────────────────────────────────────────────────┘

Admin clica [✓ Aprovar]

┌─────────────────────────────────────────────────┐
│ Aprovar Coordenadora                    [x]     │
├─────────────────────────────────────────────────┤
│ Tem certeza que quer aprovar Maria Silva?       │
│                                                  │
│ Observações (opcional)                          │
│ ┌──────────────────────────────────────────┐    │
│ │ Validado com RH                          │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│         [Cancelar] [✓ Aprovar]                   │
│                                                  │
└─────────────────────────────────────────────────┘

Admin clica [✓ Aprovar]

Maria agora está em status "APROVADA" no banco:
- coordenadores/_id: {
    status: "aprovada",
    dataAprovacao: "2025-05-24T14:30:00Z",
    aprovadoPor: "uid_admin",
    observacoes: "Validado com RH"
  }

Maria pode agora fazer LOGIN em /#/coord/
```

---

## 🎬 Cena 4: Coordenador faz login

```
Maria acessa /#/coord/

┌─────────────────────────────────────────────────┐
│               👩‍💼 Acesso Coordenadora               │
│               Inventário SEMCAS                  │
├─────────────────────────────────────────────────┤
│                                                  │
│ Token de acesso                                  │
│ ┌──────────────────────────────────────────┐    │
│ │ Cole o código aqui ou use o QR...        │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│             [✓ Acessar]                          │
│                     ou                           │
│  ────────────────────────────────────────────   │
│         ou escanear QR code                      │
│                                                  │
│         ┌─────────────┐                          │
│         │             │                          │
│         │   📱 QR     │                          │
│         │             │                          │
│         └─────────────┘                          │
│                                                  │
│ Esta página é exclusiva para coordenadoras de   │
│ unidades. Você terá acesso limitado aos itens  │
│ da sua unidade.                                 │
│                                                  │
└─────────────────────────────────────────────────┘

Sistema valida credenciais de Maria
Sistema detecta que é Coordenadora > uid > busca em coordenadores
Sistema vê status = "aprovada"
Sistema permite LOGIN ✅

Maria vê dashboard dela:

┌─────────────────────────────────────────────────┐
│ 👩‍💼 Maria Silva                     [Sair]          │
│ 01 - Prefeitura                                 │
├─────────────────────────────────────────────────┤
│ 📦 Meu Inventário    📊 Relatório                │
│                                                  │
│ 📦 Itens pendentes                               │
│                                                  │
│ [🔍 Buscar item...]                             │
│                                                  │
│ ┌─────────────┬─────────────┐                   │
│ │ CADEIRA     │ MESA        │                   │
│ │ Nº 00123    │ Nº 00124    │                   │
│ │ Fornecedor  │ Fornecedor  │                   │
│ │ Pendente    │ Pendente    │                   │
│ └─────────────┴─────────────┘                   │
│                                                  │
└─────────────────────────────────────────────────┘

Maria pode agora inventariar os itens da sua unidade.
```

---

## 🎬 Cena 5: Admin desativa ou rejeita

```
Se admin rejeitar uma coordenadora:

┌─────────────────────────────────────────────────┐
│ Rejeitar Coordenadora                   [x]     │
├─────────────────────────────────────────────────┤
│ Você está rejeitando Maria Silva                │
│                                                  │
│ Motivo da rejeição *                            │
│ ┌──────────────────────────────────────────┐    │
│ │ Matrícula não encontrada no sistema RH   │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│     [Cancelar] [✕ Rejeitar]                     │
│                                                  │
└─────────────────────────────────────────────────┘

Admin clica [✕ Rejeitar]

coordenadores/uid_maria = {
  status: "rejeitada",
  dataRejeicao: "2025-05-24T15:00:00Z",
  motivoRejeicao: "Matrícula não encontrada no sistema RH",
  rejeitadaPor: "uid_admin"
}

Se Maria tentar acessar /#/coord/:
- Sistema tenta buscar status
- Vê status = "rejeitada"
- Mostra: "Seu acesso foi rejeitado pelo administrador"
- Rejeita o login ❌
```

---

## ⏱️ Cena 6: Logout automático em ação

```
Maria está logada e inventariando itens.

A cada 30 segundos:
- Sistema faz query: coordenadores/uid_maria
- Verifica status

[30s] Status = "aprovada" ✓ (continua)
[60s] Status = "aprovada" ✓ (continua)
[90s] Admin clica [🗑 Desativar] em Maria

Admin vê modal:
┌─────────────────────────────────────────────────┐
│ Desativar Coordenadora                  [x]     │
├─────────────────────────────────────────────────┤
│ Você está desativando Maria Silva.              │
│ Ela não conseguirá mais acessar o sistema.      │
│                                                  │
│ Motivo (opcional)                               │
│ ┌──────────────────────────────────────────┐    │
│ │ Saiu de férias                           │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│     [Cancelar] [🗑 Desativar]                    │
│                                                  │
└─────────────────────────────────────────────────┘

Admin clica [🗑 Desativar]

Firestore atualiza: coordenadores/uid_maria = {
  status: "desativada",
  dataDesativacao: "2025-05-24T15:05:00Z",
  motivoDesativacao: "Saiu de férias",
  desativadaPor: "uid_admin"
}

[120s] Sistema faz query de Maria
- Vê status = "desativada"
- Imediatamente faz logout dela
- Mostra toast: "Seu acesso foi revogado pelo administrador"
- Redireciona para /#/coord/
- Maria não consegue continuar inventariando ❌

Maria pode tentar fazer login de novo, mas será rejeitada.
```

---

## 📊 Estados possíveis

```
CONVITES:
  ✅ ativo        → Pode ser usado para registrar
  ✅ usado        → Já foi usado, token inválido
  ✅ expirado     → Passaram 7 dias, token inválido
  ✅ cancelado    → Admin cancelou antes de usar

COORDENADORES:
  ⏳ pendente_aprovacao  → Aguardando análise do admin
  ✅ aprovada            → Tem acesso total à sua unidade
  ❌ rejeitada           → Admin rejeitou, não acessa
  🚫 desativada          → Removida do sistema, não acessa
```

---

## 🔐 Dados salvos no Firestore

```
Collection: convites
├── conv_1681234567890_abc123
│   ├── token: "conv_1681234567890_abc123"
│   ├── unidadeId: "u_01"
│   ├── unidadeNome: "01 - Prefeitura"
│   ├── status: "usado"
│   ├── dataCriacao: "2025-05-24T10:00:00Z"
│   ├── dataExpiracao: "2025-05-31T10:00:00Z"
│   ├── dataUso: "2025-05-24T11:00:00Z"
│   └── criadoPor: "uid_admin"

Collection: coordenadores
├── uid_maria_silva
│   ├── uid: "uid_maria_silva"
│   ├── nome: "Maria Silva"
│   ├── email: "maria@email.com"
│   ├── matricula: "12345"
│   ├── unidadeId: "u_01"
│   ├── unidadeNome: "01 - Prefeitura"
│   ├── status: "desativada"
│   ├── dataCriacao: "2025-05-24T11:00:00Z"
│   ├── dataAprovacao: "2025-05-24T14:30:00Z"
│   ├── dataDesativacao: "2025-05-24T15:05:00Z"
│   ├── aprovadoPor: "uid_admin"
│   ├── desativadaPor: "uid_admin"
│   ├── observacoes: "Validado com RH"
│   ├── motivoDesativacao: "Saiu de férias"
│   └── conviteToken: "conv_1681234567890_abc123"
```

