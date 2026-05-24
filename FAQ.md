# ❓ FAQ - Perguntas Frequentes

## ⚙️ INSTALAÇÃO

### P: Por onde começo?
R: Leia o arquivo `GUIA-IMPLEMENTACAO.md` em ordem. Ele tem 6 passos bem definidos.

### P: Preciso criar as collections no Firestore?
R: Não! As functions do firebase.js criam automaticamente quando você salva o primeiro documento. Firestore é schema-less.

### P: Posso testar localmente antes de fazer deploy?
R: Sim! Use `npm run dev`. Funcionará normal. Apenas certifique que tem `.env` com credenciais Firebase válidas.

### P: O firebase-patch.js vai substituir algo?
R: Não, apenas **ADICIONA** funções no final. Não substitui nada. Copie e cole as funções no fim do arquivo firebase.js.

---

## 🔗 LINKS E CONVITES

### P: Como gerar o link de convite?
R: Admin vai para aba "Coordenadores" → "Gerar Convite" → seleciona unidade → copia link.

### P: O link expira?
R: Sim, em 7 dias. Se tentar registrar após 7 dias, vai dar erro "Este link expirou".

### P: Posso gerar múltiplos convites para a mesma unidade?
R: Sim, sem limite. Cada convite é independente.

### P: E se perder o link? Posso regenerar?
R: Não é recomendado. Admin teria que gerar um novo convite. Mas pode copiar de novo se ainda não usou.

### P: O link contém informações sensíveis?
R: Não. É apenas um token aleatório. Se alguém tiver o link, pode registrar e ocupar a vaga, mas vai ficar pendente e será rejeitado se não for a pessoa certa.

---

## 📝 REGISTRO

### P: Coordenadora pode mudar dados após registrar?
R: Não implementado ainda. Apenas admin pode editar coordenadora (não está neste patch).

### P: Senha precisa de requisitos específicos?
R: Mínimo 6 caracteres. Considere adicionar mais requisitos depois (maiúscula, número, etc).

### P: Email pode ser duplicado?
R: Firebase vai recusar se email já existir (mesmo do admin). Mostrará "Email já cadastrado".

### P: Coordenadora vê um "Carregando..." quanto tempo?
R: Máximo 2 segundos. Se Firebase demorar mais, considera timeout.

---

## ✅ APROVAÇÃO

### P: Como admin sabe que tem coordenadora pendente?
R: Vê na aba "Coordenadores" em "⏳ Pendentes". Considere adicionar notificação por email depois.

### P: Se admin não aprovar, o que acontece?
R: Coordenadora fica em "pendente_aprovacao" pra sempre. Não consegue fazer login.

### P: Posso desaprovar um coordenador aprovado?
R: Sim, clicando em "🗑 Desativar". Sistema vai desconectar automaticamente.

### P: Se rejeitar, coordenadora sabe?
R: Não automaticamente. Considere adicionar email de notificação depois.

### P: Posso aprovar alguém que foi rejeitado antes?
R: Não neste patch. Status "rejeitada" é final. Considere adicionar "Reaprovar" depois.

---

## 🔓 LOGIN

### P: Coordenadora faz login em qual URL?
R: `https://seu-site.com/#/coord/`

### P: Qual é a diferença entre coord/ e coordregistro/?
- `/#/coord/` = Login (email + senha)
- `/#/coordregistro/TOKEN` = Registro (preenche formulário)

### P: Se coordenadora esquecer senha?
R: Não há reset neste patch. Considere adicionar depois ou resetar manualmente no Firebase Console.

### P: Posso ter múltiplos coordenadores por unidade?
R: Sim, qualquer quantidade. Mas cada um acessa independentemente e inventaria os mesmos itens.

---

## ⏱️ LOGOUT AUTOMÁTICO

### P: O logout automático é realmente automático?
R: Sim, a cada 30 segundos verifica o status. Se mudou para "rejeitada" ou "desativada", desconecta.

### P: E se não tiver internet, continua checando?
R: Vai falhar silenciosamente no catch(). Usuário continua logado. Quando voltar internet, próxima verificação vai desconectar.

### P: Posso mudar os 30 segundos?
R: Sim! Em `CoordinadorPage.jsx`, procure por `setInterval(..., 30000)` e mude para quanto quiser em ms.

### P: Se desativar enquanto está preenchendo um formulário?
R: Será desconectada em max 30s. O que preencheu será perdido (não salvou).

---

## 🎨 UI/UX

### P: Os modais ficam em mobile?
R: Sim, com `isMob ? "flex-end" : "center"`. Abre de baixo em mobile, centro em desktop.

### P: Posso customizar cores?
R: Sim, procure por `background: "#6b21a8"` e mude a cor hex. Roxo é a cor padrão da coordenadora.

### P: Os badges das coordenadores têm cores?
R: Sim:
- Pendente = 🟠 Orange
- Aprovada = 🟢 Green  
- Rejeitada = 🔴 Red
- Desativada = ⚪ Gray

### P: Preciso traduzir para inglês?
R: Não está implementado. Tudo está em português (pt-BR).

---

## 🐛 ERROS COMUNS

### P: "Erro ao registrar: Firebase não configurado"
R: Variáveis de ambiente não estão setadas:
```bash
# Se local:
Criar .env com:
VITE_FB_API_KEY=...
VITE_FB_PROJECT_ID=...
VITE_FB_STORAGE_BUCKET=...

# Se production:
Configurar Secrets no GitHub Actions
```

### P: "Convite não encontrado"
R: Token expirou ou é inválido. Verifica se status em Firestore é "ativo".

### P: "Tem certeza que quer..." mas botão não funciona
R: Verifica se há `motivoRejeicao` ou `observacoes` vazios. Alguns campos são required.

### P: Coordenadora vê "Aguarde aprovação" após registrar
R: Normal! Status dela é "pendente_aprovacao". Admin precisa aprovar.

### P: Logout automático não funciona
Checklist:
- [ ] useEffect foi adicionado em CoordinadorPage.jsx?
- [ ] Status no Firestore está mudando?
- [ ] Console mostra `Erro ao verificar status`?
- [ ] Intervalo está rodando (abre DevTools → Aba Sources)?

---

## 📊 DADOS

### P: Onde estão os convites salvos?
R: Firestore → Database → `convites` collection

### P: Onde estão os coordenadores salvos?
R: Firestore → Database → `coordenadores` collection

### P: Posso deletar um coordenador?
R: Não há função, mas pode ir ao Firestore Console e deletar manualmente.

### P: Se deletar convite, posso regenerar o link?
R: Não, o link fica inválido. Precisa gerar novo convite.

### P: Quantos documentos vai ter por coordenador?
R: 2 sempre:
1. Em `convites` (histórico)
2. Em `coordenadores` (status atual)

---

## 🚀 AVANÇADO

### P: Posso integrar com sistema de RH?
R: Sim, modificando a função `criarConviteCoordinador()` para buscar dados da API do RH antes de criar.

### P: Posso enviar email de aprovação/rejeição?
R: Sim! Use SendGrid ou Firebase Functions para enviar email após `aprovarCoordenador()` ou `rejeitarCoordenador()`.

### P: Posso rastrear quem aprovou?
R: Já está! Campo `aprovadoPor` salva o `uid` do admin que aprovou.

### P: Posso ter auditoria completa?
R: Já tem timestamps: `dataCriacao`, `dataAprovacao`, `dataDesativacao`. Adicione mais se necessário.

### P: Posso validar matrícula com API externa?
R: Sim! Modificando `handleSubmit()` em `CoordinadorRegistro.jsx` para fazer call à sua API.

---

## 💾 BACKUP E RECUPERAÇÃO

### P: Se apagar tudo, como recupero?
R: Firestore tem backup automático. Entre em contato com Google Cloud.

### P: Posso exportar dados de coordenadores?
R: Sim, via Firebase Console → Export Collection.

### P: Posso importar dados antigos?
R: Sim, via Firebase Console → Import Collection (se estiver em JSON válido).

---

## 🔐 SEGURANÇA

### P: Coordenadora consegue editar dados de outra unidade?
R: Não, `CoordinadorPage.jsx` filtra `unidadeId`. Só vê itens da sua unidade.

### P: Admin consegue impersonar coordenadora?
R: Não há função, mas poderia via Firebase Console modificando `uid`.

### P: Senha fica segura?
R: Sim! Firebase Auth hash automaticamente. Nunca salva em plain text no Firestore.

### P: Posso limitar tentativas de login?
R: Firebase Auth faz isso automaticamente após 5 tentativas erradas em 5 minutos.

---

## 📱 MOBILE

### P: Funciona em smartphone?
R: Sim! Todos os componentes têm `isMob` para responsividade.

### P: Modal abre correto em mobile?
R: Sim, de baixo para cima (`borderRadius: isMob ? "20px 20px 0 0" : 16`).

### P: Teclado virtual interfere?
R: Pode. Considere adicionar `window.scrollIntoView()` nos inputs.

### P: Consegue fotografar em mobile?
R: Sim, `CameraModal` funciona em qualquer dispositivo com câmera.

---

## 📞 SUPORTE

### P: Encontrei um bug, como reporto?
R: Descreva:
1. O que estava fazendo
2. Qual erro apareceu
3. Console.log (DevTools → Console)
4. Firestore data relevante

### P: Posso customizar o fluxo?
R: Sim! O código está bem documentado. Cada função tem comentários.

### P: Preciso de mais features?
R: Recomendações para próximas melhorias estão em `MELHORIAS.md` (criar depois).

