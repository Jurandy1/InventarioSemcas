# 🚀 GUIA DE IMPLEMENTAÇÃO - Patches 1, 2, 3 e 6

## ✅ O que foi implementado

1. **Registro de Coordenador** - Formulário baseado em token de convite
2. **Gerencimento de Convites** - Collection no Firestore com TTL de 7 dias
3. **Dashboard de Coordenadores** - Aba no admin com pendentes/aprovadas/rejeitadas
4. **Logout Automático** - Revogação automática de acesso ao coordenador

---

## 📋 PASSO A PASSO DE IMPLEMENTAÇÃO

### PASSO 1: Copiar novos arquivos

```bash
# Copiar os 3 novos componentes:
cp /home/claude/CoordinadorRegistro.jsx src/app/
cp /home/claude/CoordenadoresTab.jsx src/app/
```

### PASSO 2: Atualizar firebase.js

Abra `src/services/firebase.js` e **ADICIONE** no final do arquivo (antes do fechamento da chave) as funções do arquivo:

```bash
# Copiar conteúdo de firebase-patch.js
cat /home/claude/firebase-patch.js
```

**Copie tudo de "// ===== GERENCIAR CONVITES =====" até o final e cole em `src/services/firebase.js`**

### PASSO 3: Atualizar main.jsx

Abra `src/main.jsx` e **SUBSTITUA COMPLETAMENTE** o conteúdo pelo arquivo:

```bash
cat /home/claude/main-patch.jsx
```

### PASSO 4: Atualizar App.jsx (Dashboard Admin)

Abra `src/app/App.jsx` e faça 3 modificações:

#### 4.1 - Adicionar import (topo do arquivo):
```javascript
import { CoordenadoresTab } from "./CoordenadoresTab.jsx";
```

#### 4.2 - Modificar array navs (procure por "const navs = ["):
```javascript
const navs = [
  { id: "inventario", icon: "📦", l: "Inventário" },
  { id: "busca", icon: "🔍", l: "Busca" },
  { id: "itens", icon: "🪑", l: "Itens" },
  { id: "nf", icon: "🧾", l: "Notas" },
  { id: "tombos", icon: "🔖", l: "Tombos" },
  { id: "dash", icon: "📊", l: "Dashboard" },
  { id: "coordenadores", icon: "👩‍💼", l: "Coordenadores" },  // ← ADICIONAR ESTA LINHA
  { id: "locais", icon: "📍", l: "Locais" },
];
```

#### 4.3 - Adicionar renderização da aba (procure por "tab === "dash""):
Depois de:
```javascript
{tab === "dash" && (
  <div>
    {/* conteúdo do dashboard */}
  </div>
)}
```

Adicione:
```javascript
{tab === "coordenadores" && (
  <CoordenadoresTab 
    unidades={unidades} 
    showT={showT} 
    isMob={isMob} 
  />
)}
```

### PASSO 5: Atualizar CoordinadorLogin.jsx

Abra `src/app/CoordinadorLogin.jsx` e modifique a função `validateToken` (procure por "const validateToken = async"):

**SUBSTITUA TODO O CONTEÚDO DA FUNÇÃO** por:

```javascript
const validateToken = async (tok) => {
  try {
    setError("");
    const coordDocs = await fsGetAll("coordenadores");
    const found = coordDocs.find((c) => c?._id === tok || c?.token === tok);

    if (found && found.ativa) {
      // NOVO: Verificar status
      if (found.status === "rejeitada") {
        setToken(null);
        setCoordData(null);
        setStatus("login");
        setError("Seu acesso foi rejeitado pelo administrador");
        return;
      }
      
      if (found.status === "desativada") {
        setToken(null);
        setCoordData(null);
        setStatus("login");
        setError("Seu acesso foi revogado");
        return;
      }
      
      if (found.status !== "aprovada") {
        setToken(null);
        setCoordData(null);
        setStatus("login");
        setError("Aguarde aprovação do administrador");
        return;
      }

      setToken(tok);
      setCoordData(found);
      setStatus("dashboard");
    } else {
      setToken(null);
      setCoordData(null);
      setStatus("login");
      setError("Token inválido ou expirado");
    }
  } catch (err) {
    console.error("Erro ao validar token:", err);
    setToken(null);
    setCoordData(null);
    setStatus("login");
    setError("Erro ao acessar o sistema");
  }
};
```

### PASSO 6: Atualizar CoordinadorPage.jsx

Abra `src/app/CoordinadorPage.jsx` e adicione este hook **logo após os outros useState** (procure por "const [saving, setSaving]"):

```javascript
useEffect(() => {
  async function verificarStatus() {
    try {
      const interval = setInterval(async () => {
        try {
          const { obterCoordPorUid } = await import("../services/firebase.js");
          const coord = await obterCoordPorUid(coordData?.uid);
          
          if (!coord || coord.status === "rejeitada" || coord.status === "desativada") {
            try {
              localStorage.removeItem("inv-coord-session");
            } catch {}
            onLogout();
            showT("Seu acesso foi revogado pelo administrador");
          }
        } catch (e) {
          console.error("Erro ao verificar status:", e);
        }
      }, 30000); // A cada 30 segundos

      return () => clearInterval(interval);
    } catch (e) {
      console.error("Erro ao inicializar verificação:", e);
    }
  }

  verificarStatus();
}, [coordData?.uid, onLogout, showT]);
```

---

## 🔗 ROTAS E URLs

| Página | URL |
|--------|-----|
| Admin Dashboard | `/#/inventario` |
| Aba Coordenadores | `/#/coordenadores` |
| Login Coordenador | `/#/coord/` |
| Registro Coordenador | `/#/coordregistro/TOKEN_AQUI` |

---

## 🎯 FLUXO COMPLETO

### 1️⃣ Admin gera convite
- Admin vai para aba "Coordenadores"
- Clica "+ Gerar Convite"
- Seleciona unidade e matrícula
- Recebe um link como: `https://seu-site.com/#/coordregistro/conv_1234567890_abc123`

### 2️⃣ Coordenador se registra
- Recebe o link do admin
- Abre em navegador
- Preenche: Nome, Email, Matrícula, Senha
- Clica "✓ Registrar"
- Vê mensagem: "Seu acesso foi enviado para aprovação"

### 3️⃣ Admin aprova/rejeita
- Vê coordenadora em "⏳ Pendentes"
- Clica "✓ Aprovar" ou "✕ Rejeitar"
- Se aprovar: Coordenadora recebe acesso
- Se rejeitar: Coordenadora vê mensagem de rejeição

### 4️⃣ Coordenador faz login
- Vai para `/#/coord/`
- Coloca email e senha
- Sistema valida que está "aprovada"
- Consegue acessar a unidade dela

### 5️⃣ Logout automático
- A cada 30 segundos, verifica status no banco
- Se admin desativar ou rejeitar, coordenador é desconectado automaticamente

---

## 📊 DADOS NO FIRESTORE

### Collection: `convites`
```javascript
{
  _id: "conv_1234567890_abc123",
  token: "conv_1234567890_abc123",
  unidadeId: "u_01",
  unidadeNome: "01 - Prefeitura",
  matricula: "12345",
  status: "ativo" | "usado" | "expirado" | "cancelado",
  dataCriacao: "2025-05-24T10:30:00Z",
  dataExpiracao: "2025-05-31T10:30:00Z",
  dataUso: "2025-05-24T11:45:00Z",
  criadoPor: "uid_do_admin"
}
```

### Collection: `coordenadores`
```javascript
{
  _id: "uid_usuario",
  uid: "uid_usuario",
  nome: "Maria Silva",
  email: "maria@email.com",
  matricula: "12345",
  unidadeId: "u_01",
  unidadeNome: "01 - Prefeitura",
  status: "pendente_aprovacao" | "aprovada" | "rejeitada" | "desativada",
  dataCriacao: "2025-05-24T10:30:00Z",
  dataAprovacao: "2025-05-24T11:00:00Z",
  dataRejeicao: null,
  dataDesativacao: null,
  aprovadoPor: "uid_admin",
  rejeitadaPor: null,
  desativadaPor: null,
  observacoes: "Validado com RH",
  motivoRejeicao: null,
  motivoDesativacao: null,
  conviteToken: "conv_1234567890_abc123"
}
```

---

## ✨ FEATURES IMPLEMENTADOS

✅ Geração de convites com link customizado  
✅ Registro de coordenador com validação  
✅ Dashboard de aprovação/rejeição  
✅ Status visual (Pendente, Aprovada, Rejeitada, Desativada)  
✅ Motivos de rejeição/desativação  
✅ Auditoria (quem aprovou, quando)  
✅ Convite expira em 7 dias  
✅ Logout automático quando desativada  
✅ Verificação a cada 30 segundos  
✅ Responsivo mobile/desktop  

---

## 🐛 TESTES RECOMENDADOS

1. **Gerar convite e registrar**
   - Gerar convite para unidade X
   - Copiar link e abrir em incógnito
   - Registrar com dados válidos
   - Verificar em "Pendentes"

2. **Aprovar coordenador**
   - Aprovar uma coordenadora pendente
   - Login com email/senha dela
   - Verificar acesso à unidade

3. **Rejeitar coordenador**
   - Rejeitar uma coordenadora pendente
   - Tentar login com email dela
   - Deve recusar e mostrar mensagem

4. **Desativar coordenador**
   - Aprovar e depois desativar uma coordenadora
   - Se ela estiver logada, logout automático em max 30s

5. **Link expirado**
   - Gerar convite
   - Esperar 7 dias (ou mudar data no banco)
   - Tentar registrar
   - Deve recusar com "expirou"

---

## 📞 TROUBLESHOOTING

**Q: Coordenador não consegue se registrar**
- Verificar se token é válido em Firestore `convites`
- Verificar se status é "ativo"
- Verificar se data de expiração ainda é futura

**Q: Admin não vê aba de coordenadores**
- Verificar se import está em App.jsx
- Verificar se CoordenadoresTab.jsx está em src/app/

**Q: Logout automático não funciona**
- Verificar console do navegador
- Verificar se interval está rodando (30s)
- Verificar status no Firestore

**Q: Link de convite muito longo**
- Normal. Copiar e compartilhar via email/WhatsApp
- Considerar encurtador de URL se necessário

