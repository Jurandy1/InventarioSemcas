# Debug Session: white-screen-reload
- **Status**: [OPEN]
- **Issue**: Tela branca e ícone de refresh/carregamento infinito no preview (Vite). Possível reload contínuo do client/HMR.
- **Debug Server**: http://192.168.15.14:7777/event
- **Log File**: .dbg/trae-debug-log-white-screen-reload.ndjson

## Reproduction Steps
1. Iniciar o dev server Vite.
2. Abrir a URL de rede (ex.: http://192.168.15.14:5173/).
3. Observar tela branca / reload infinito.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | O preview não alcança o dev server (bloqueio de localhost/IP, CORS, firewall) e o app não carrega os módulos | High | Med | Pending |
| B | `src/main.jsx` ou imports dinâmicos lançam erro em runtime e o Vite client força reload (HMR fallback) | High | Low | Pending |
| C | O transform do React/JSX falha (plugin react não aplicado / otimização) e o browser recebe código inválido | Med | Med | Pending |
| D | Dependência pesada (ex.: `xlsx`) ou fetch travado bloqueia o boot e parece “carregando infinito” | Med | Med | Pending |
| E | Problema de path/base/rota (`/coord/`, `BASE_URL`) causa seleção errada de bundle e quebra o boot | Low | Low | Pending |

## Log Evidence
- Evidência inicial: `index.html` carregava repetidamente, mas não havia eventos do `main.jsx` no Debug Server.
- Evidência local: requisição `GET /src/main.jsx` no dev server travava/timeout enquanto `GET /@vite/client` e `/` respondiam.
- Fix aplicado: limpar cache `node_modules/.vite*` e iniciar Vite com dep optimizer desativado (config `optimizeDeps.disabled: true`).

## Verification Conclusion
- (a preencher)

## Notes
- `@vitejs/plugin-react` instalado: `4.7.0`.
- Python não disponível no ambiente; Debug Server rodando via Node em `.dbg/debug-server.js`.
