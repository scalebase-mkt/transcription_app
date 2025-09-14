# Prompt-guia — App de Transcrição (PT-BR)

## 1. Contexto do projeto
Quero criar um app simples de transcrição que funcione assim:  
- O usuário grava **áudio do microfone (in)** ou **áudio da aba (out)** direto no navegador.  
- O app envia esse áudio para o back-end.  
- O back-end processa e envia o arquivo para a **API do Google Speech-to-Text**.  
- A transcrição sai em português do Brasil, com alta acurácia e pontuação.  
- O usuário pode baixar a transcrição em **.txt** e também o áudio em **.mp3/.wav**.  
- Os arquivos expiram e são apagados automaticamente após **2 horas**.  

Este projeto deve ser feito para rodar localmente (via `npm run dev`) e depois publicado em produção (Render, Railway ou Hostinger com suporte a Node.js).  

---

## 2. Arquitetura
- **Front-end (web page)**  
  - HTML + JS simples.  
  - Botões para gravar áudio do mic e da aba.  
  - Botão para enviar o áudio e links para baixar arquivos gerados.  
  - Exibir status e aviso: “Seus arquivos ficam disponíveis por 2h e depois são apagados automaticamente”.  

- **Back-end (Node.js + Express)**  
  - Recebe upload de áudio.  
  - Converte para formato correto (WAV 16kHz mono).  
  - Envia para **Google Cloud Storage** e pede transcrição via **Speech-to-Text API**.  
  - Gera arquivos `.txt`, `.mp3` e `.wav`.  
  - Apaga tudo após 2 horas.  

- **Integração Google Cloud**  
  - Usar **Service Account** com permissões em Speech-to-Text e Storage.  
  - Guardar chave no `.env`.  
  - Usar **LongRunningRecognize** para suportar até 1 hora de áudio.  

- **Armazenamento temporário**  
  - Pasta `tmp/` no servidor para arquivos locais.  
  - Bucket no Google Cloud Storage para transcrição.  
  - Limpeza automática de arquivos após 2 horas.  

---

## 3. Arquivos a gerar
O ChatGPT deve criar estes arquivos (um de cada vez, conforme pedido):  
- `package.json` → dependências e scripts.  
- `.env.example` → modelo de variáveis de ambiente.  
- `server.js` → servidor principal (rotas de upload, job status, download, limpeza).  
- `lib/ffmpeg.js` → funções auxiliares para conversão de áudio (wav/mp3).  
- `lib/transcribe-google.js` → integração com Google Speech-to-Text.  
- `public/index.html` → página do usuário (UI mínima).  

---

## 4. Estilo do código
- Código **claro, modular e comentado**.  
- Evitar complexidade desnecessária.  
- Usar boas práticas (async/await, variáveis de ambiente, tratamento de erros).  
- Prioridade: **funcionar bem em PT-BR com alta acurácia**.  

---

## 5. Critérios de sucesso
- O app roda localmente com `npm run dev`.  
- O usuário consegue gravar áudio, enviar e baixar transcrição/áudios.  
- Áudios de até **1h** são processados com acurácia.  
- Retenção automática de **2h** funcionando.  
- Deploy em Render/Railway sem ajustes grandes.  

---

## 6. Como usar este guia no VS Code
1. Abra este arquivo (`prompt-guia.md`) dentro do VS Code.  
2. Quando precisar gerar um arquivo, selecione a seção **“Arquivos a gerar”** e peça ao ChatGPT:  
   - Exemplo: *“Com base no prompt-guia.md, crie o `package.json`.”*  
   - Depois: *“Agora crie o `server.js` seguindo o prompt-guia.md.”*  
   - Continue até completar todos os arquivos.  
3. Cole cada arquivo no seu projeto e siga a ordem:  
   - `package.json` → `.env.example` → `server.js` → libs (`ffmpeg.js`, `transcribe-google.js`) → `index.html`.  

Assim você monta o sistema peça por peça até concluir todos os arquivos.
