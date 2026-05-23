# PATCH — Inventário SEMCAS v2
# Arquitetura: XLSX estático → IndexedDB → Firebase Storage (fotos) → Firestore (resultados)

## RESPOSTA RÁPIDA: A PLANILHA
Sim. O arquivo `patrimonio_por_unidade.xlsx` fica na pasta `public/` do projeto.
O Vite serve ele como arquivo estático. O app baixa UMA VEZ e salva no IndexedDB
do navegador. Da segunda vez em diante carrega instantaneamente offline.
NÃO precisa de upload toda vez.

---

## ARQUIVOS CRIADOS/MODIFICADOS

### NOVOS (criar do zero)
| Arquivo                        | O que faz                                              |
|-------------------------------|--------------------------------------------------------|
| src/utils/db.js               | Helper para IndexedDB (cache local do XLSX)            |
| src/services/storage.js       | Upload de fotos para Firebase Storage via REST         |

### SUBSTITUIR (apagar o antigo, colar o novo)
| Arquivo                        | O que mudou                                            |
|-------------------------------|--------------------------------------------------------|
| src/utils/xlsx.js             | Agora carrega do IndexedDB (cache 24h) ou do servidor |
| src/app/App.jsx               | Arquitetura completa nova (ver detalhes abaixo)        |
| .github/workflows/pages.yml   | Sem secrets novos (removeu Cloudinary)                 |

### DELETAR
| Arquivo                        | Motivo                                                 |
|-------------------------------|--------------------------------------------------------|
| src/services/cloudinary.js    | Substituído por storage.js (Firebase Storage)          |

---

## ARQUIVO FÍSICO A ADICIONAR NO REPOSITÓRIO
```
public/
  patrimonio_por_unidade.xlsx   ← copiar a planilha gerada aqui
```
Isso faz o Vite servir o arquivo em:
  DEV:  http://localhost:5173/patrimonio_por_unidade.xlsx
  PROD: https://usuario.github.io/InventarioSemcas/patrimonio_por_unidade.xlsx

---

## O QUE MUDOU NO App.jsx (resumo para o AI)

### Estados removidos
- photos          → fotos agora são URLs no Firestore (dentro do objeto found)
- uploadStatus    → substituído por uploading + uploadMsg

### Estados adicionados
- loadingXlsx     → boolean: carregando XLSX
- uploading       → boolean: enviando foto ao Storage
- uploadMsg       → string: "Enviando foto 1/3..."
- globalSearch    → string: termo de busca global
- globalResults   → array: resultados da busca global
- globalSearching → boolean: buscando

### Funções removidas
- saveUnidades()       → XLSX é estático, não salva no Firebase
- savePhotos()         → fotos vão para Firebase Storage
- delPhotos()          → substituído por deletePhoto() do storage.js
- handleFileUpload()   → não existe mais upload manual de XLSX
- saveToFirebase()     → era o save único de tudo; agora é por coleção

### Funções adicionadas/alteradas
- _loadXlsx(force?)       → carrega unidades do IndexedDB ou servidor
- _loadFirebase()         → lê 3 coleções: inventario, locais, tombosNE
- markFound(...)          → salva em fsSet("inventario", id, entry)
- saveDetail()            → faz upload das fotos novas antes de salvar
- addLocal()              → salva em fsSet("locais", id, data)
- delLocal()              → fsDel("locais", id)
- finalizarInv()          → salva cada item em fsSet("tombosNE", id, data)
- doGlobalSearch(query)   → varre todos os unidades.itens localmente

### Nova aba adicionada no menu
- 🔍 Busca (id: "busca") → entre Inventário e Itens
  Busca em tempo real nos 6.702 itens de todas as unidades
  Campos: número, descrição, espécie, fornecedor, marca, NF
  Limite: 200 resultados, debounce 300ms

### Estrutura do Firebase (Firestore)

ANTES (problemático):
  appdata/main → { unidades: [...6702 itens...], found: [...], locais: [...] }
  ↑ estourava o limite de 1MB

DEPOIS (correto):
  inventario/{patrimonioId} → { estado, situacao, localId, obs, marca, origem, fotoUrls[], data, user }
  locais/{localId}          → { nome, desc }
  tombosNE/{patrimonioId}   → { patrimonioId, descricao, especie, unidade, dataFin }
  manuais/{itemId}          → { ...dadosItem, unidadeId }

### Estrutura do Firebase Storage
  semcas/inventario/{patrimonioId}_{timestamp}_{index}.jpg

### Fluxo de fotos (NOVO)
  1. Usuário tira foto → base64 temporário em form.current.detNewBase64[]
  2. Usuário clica Salvar → uploadPhotos() envia para Firebase Storage
  3. Storage retorna URL pública → salva no Firestore dentro do found item
  4. Na consulta → <img src={url}> carrega direto do CDN do Firebase

---

## IMPORTS QUE MUDARAM NO App.jsx

REMOVER:
  import * as XLSX from "xlsx";
  import { parseXLSXFile } from "../utils/xlsx.js";

ADICIONAR:
  import { loadUnidades } from "../utils/xlsx.js";
  import { uploadPhotos, isStorageOk as isCloudinaryOk, deletePhoto } from "../services/storage.js";

---

## CONFIGURAÇÃO DO FIREBASE STORAGE

1. Console Firebase → Storage → Get Started → Next → Done
2. Regras do Storage (substituir as padrão):

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /semcas/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}

---

## SECRETS DO GITHUB (sem mudanças)
Continua usando os mesmos 3 secrets:
  VITE_FB_API_KEY
  VITE_FB_PROJECT_ID
  VITE_FB_STORAGE_BUCKET   ← esse já existia, agora também serve para fotos

NÃO precisa mais de:
  VITE_CLOUDINARY_CLOUD_NAME     (remover se existir)
  VITE_CLOUDINARY_UPLOAD_PRESET  (remover se existir)

---

## VARIÁVEIS DE AMBIENTE (.env local para dev)
VITE_FB_API_KEY=sua_api_key
VITE_FB_PROJECT_ID=seu_project_id
VITE_FB_STORAGE_BUCKET=seu_bucket.appspot.com

---

## ORDEM DE EXECUÇÃO DO DEPLOY

1. Copiar patrimonio_por_unidade.xlsx → public/
2. Criar src/utils/db.js
3. Substituir src/utils/xlsx.js
4. Criar src/services/storage.js
5. Substituir src/app/App.jsx
6. Deletar src/services/cloudinary.js (se existir)
7. Substituir .github/workflows/pages.yml
8. git add . && git commit -m "v2: xlsx cache + storage + busca global"
9. git push → GitHub Actions faz o deploy

---

## DEPENDÊNCIAS (sem mudanças no package.json)
Todas as dependências já existiam:
  react, react-dom, xlsx — produção
  vite, @vitejs/plugin-react — dev

---

## LIMITES GRATUITOS UTILIZADOS

| Serviço           | Recurso             | Limite gratuito     | Uso estimado      |
|-------------------|---------------------|---------------------|-------------------|
| Firebase Firestore| Leituras/dia        | 50.000              | ~100/dia          |
| Firebase Firestore| Escritas/dia        | 20.000              | ~50/dia           |
| Firebase Storage  | Armazenamento       | 5 GB                | ~2 GB (fotos)     |
| Firebase Storage  | Download/dia        | 1 GB                | ~100 MB           |
| GitHub Pages      | Hospedagem          | Ilimitado           | —                 |
| IndexedDB         | Cache local         | Ilimitado (browser) | ~10 MB (XLSX)     |
