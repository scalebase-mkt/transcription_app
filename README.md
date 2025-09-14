# App de Transcrição (PT-BR)

Aplicação simples para gravar áudio (microfone ou áudio da aba), converter para WAV 16kHz mono e transcrever com Gemini (AI Studio). O backend tenta transcrever em arquivo único (SINGLE_SHOT) e, em caso de erro/timeout (413/429/5xx ou acima de REQUEST_TIMEOUT_SEC), cai automaticamente para modo em blocos (chunks) de forma transparente. Arquivos expiram após 2 horas.

## Requisitos
- Node.js 20+
- Chave do AI Studio (Gemini): `GEMINI_API_KEY`

## Configuração
1. Copie `.env.example` para `.env` e preencha:
   - `GEMINI_API_KEY`
   - Parâmetros: `SINGLE_SHOT=true`, `FALLBACK_AUTO_CHUNK=true`, `REQUEST_TIMEOUT_SEC=600`, `MAX_UPLOAD_MB`, `TTL_HOURS` (opcional; padrão 2).
2. Instale dependências: `npm install`

## Execução
- Desenvolvimento: `npm run dev`
- Produção: `npm start`

O servidor sobe em `http://localhost:3000`. A UI está em `public/index.html`.

## Fluxo
1. Front-end grava áudio (microfone ou aba) com MediaRecorder.
2. Back-end recebe via `/upload` (multer), salva em `tmp/`.
3. Converte para WAV 16k mono e para MP3 (download amigável).
4. Transcreve com Gemini em modo single-shot; se necessário, divide em chunks e concatena a transcrição.
5. Quando finaliza, escreve a transcrição em `.txt` e disponibiliza downloads.
6. Limpeza automática local após `TTL_HOURS` (padrão 2h).

## Rotas
- `POST /upload` — multipart/form-data com campo `audio` e opcional `source` (`mic` | `tab`). Retorna `{ id }`.
- `GET /status/:id` — status do processamento do job.
- `GET /download/:id/:type` — baixa `wav|mp3|txt` gerado.
- `GET /health` — verificação simples.

## Deploy (Render)
Use `deploy.render.yaml`. Configure as variáveis de ambiente no painel da Render (`GEMINI_API_KEY`, `SINGLE_SHOT`, `FALLBACK_AUTO_CHUNK`, `REQUEST_TIMEOUT_SEC`, etc.).

## Observações
- Este projeto mantém os arquivos localmente por até `TTL_HOURS`. Não armazene dados sensíveis.
- A acurácia depende da qualidade do áudio e do modelo selecionado em Gemini.
