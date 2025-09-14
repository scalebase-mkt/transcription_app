# TESTES MANUAIS

## 1) Ambiente
- Crie `.env` a partir de `.env.example` e preencha `GCP_PROJECT_ID`, `GCS_BUCKET` e credenciais.
- `npm install`

## 2) Execução local
- `npm run dev`
- Acesse `http://localhost:3000`.

## 3) Fluxo principal
- Clique em “Gravar Microfone (in)” e grave alguns segundos.
- Pare e clique em “Enviar para Transcrição”.
- Observe o status mudar: `processing` → `uploading` → `transcribing` → `completed`.
- Faça download dos arquivos `.txt`, `.wav` e `.mp3` e valide:
  - WAV: 16kHz mono (verifique com um player/inspector de áudio).
  - TXT: Transcrição em PT-BR com pontuação coerente.

## 4) Áudio da aba
- Clique em “Gravar Áudio da Aba (out)”. Selecione uma aba com som.
- Repita o fluxo de upload/transcrição.

## 5) Erros e limites
- Envie um arquivo inválido para observar mensagem de erro.
- Teste arquivos longos (até 1h) e confirme que o job completa.

## 6) Limpeza (retenção 2h)
- Confirme que após 2h os arquivos locais e objetos no bucket são removidos.
- Inspecione logs do servidor.

## 7) Healthcheck
- `GET /health` deve retornar `{ ok: true }`.

