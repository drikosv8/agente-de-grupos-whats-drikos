# 🤖 Agente IA para Grupos de WhatsApp

Este projeto é um sistema completo de múltiplos agentes para grupos do WhatsApp com uso de **IA personalizada**, baseado em **OpenAI GPT**, TTS, Whisper e interpretação de imagem. 
Cada grupo possui **comportamento isolado**, com chave de API, voz e modelo distintos, gerenciados via painel web moderno.

Tenha um único número de Agente Robô em varios grupos do WhatsApp com personalidades e contextos diferentes, envios e recebimentos de mensagens de texto, em audio, e leitura de imagem.

Um assistente pessoal para o grupo whtatsapp.
Você poderá pedir o resumo de assuntos que rolaram no grupo ontem, hoje e na última semana, alem de pedir para o robô responder perguntas por mensagem e audio e ler imagens.
Você tambem poderá fazer pesquisas de paravras chaves de assuntos que rolaram no grupo e resgatar a conversa relacionada, mesmo que já tenha sido apagada do grupo. 

Perguntou para o agente em texto, ele responde em texto, perguntou por audio, ele responde em audio e ainda faz interpretação de imagens. 

Adicionado 20/05/2025 Integração com servidor emby, possibilitando a IA realizar consultas no banco de dados de suas mídias de filmes e séries.

---

## ✨ Funcionalidades

- 🧠 Memória e contexto por grupo (sem misturar dados)
- 📣 Respostas por voz com TTS customizado
- 🤖 Escolha de modelo OpenAI por grupo (gpt-4o, gpt-3.5-turbo, etc.)
- 🌍 Fuso horário individual configurável
- 🎙️ Transcrição automática de áudios (Whisper)
- 🖼️ Interpretação de imagens via GPT-4o Vision
- 💻 Painel Web com login seguro e gerenciamento completo
- 🔒 Acesso controlado apenas para grupos cadastrados
- 🧾 Histórico por grupo salvo no banco de dados
- 📺 Integração com servidor Emby,
  Permite consultar filmes, séries diretamente via WhatsApp, integrando com múltiplos servidores Emby configuráveis.

---

## 💬 Comandos Disponíveis no Grupo

```
@nome_do_bot sua pergunta
/buscar palavra-chave
/resumo hoje
/resumo ontem
/resumo semana
/filme titulo
/serie titulo
```
Use o @nome_do_agente para interagir, ou responda encima da resposta do agente.

🎤 Envie áudios → serão transcritos  
🖼️ Envie imagens → serão interpretadas

---

## 🛡️ Segurança

- Apenas grupos cadastrados em `grupos_config` podem interagir
- Cada grupo possui sua própria chave OpenAI e contexto
- Nenhuma requisição à OpenAI é feita sem validação do grupo

---

## 🧩 Requisitos

- Node.js 18+  
- MySQL 8+  
- Conta e chave da API OpenAI  
- WhatsApp autenticado para gerar QRCode

---

## ⚙️ Instalação

```bash
git clone https://github.com/drikosv8/agente-de-grupos-whats-drikos.git
cd agente-de-grupos-whats-drikos
npm install
```

### 📄 Arquivo `.env`

```env
# Banco de Dados
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=agente_ia_grupo

# Painel
LOGIN_USER=admin
LOGIN_PASSWORD=1234

# Porta
PORT=8000
```

### ▶️ Inicialização

```bash
node index.js
```

Acesse no navegador: [http://localhost:8000](http://localhost:8000)  
Faça login com as credenciais do `.env`

---

## 🗃️ Estrutura do Banco de Dados (MySQL)

```sql
CREATE DATABASE IF NOT EXISTS `agente_ia_grupo`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `agente_ia_grupo`;

CREATE TABLE grupos_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_grupo VARCHAR(255),
  nome_bot VARCHAR(100),
  id_grupo_whatsapp VARCHAR(100) UNIQUE,
  fuso_horario VARCHAR(100),
  voz_ai VARCHAR(50),
  modelo_ai VARCHAR(50),
  comportamento TEXT,
  openai_api_key TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo VARCHAR(255),
  autor VARCHAR(255),
  mensagem TEXT,
  data DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE integracoes_emby (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id VARCHAR(100) NOT NULL,
  nome VARCHAR(100),
  url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🛠️ Tecnologias Utilizadas

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [OpenAI API](https://platform.openai.com/docs)
- [Express.js](https://expressjs.com/)
- [Twig.js](https://github.com/twigjs/twig.js)
- [Bootstrap 5](https://getbootstrap.com/)
- [Moment.js](https://momentjs.com/)
- MySQL

---

## 🪪 Licença

MIT © [Driko's v8]  
🔗 https://griteplay.eu.org/dev


---

☕ **Gostou do projeto? Me pague um café!**  
Se este projeto foi útil para você, considere apoiar com um café. 😄  
📩 adriano.p.oliveira85@gmail.com (Pix)

Muito obrigado! ❤️

=======
# agente-de-grupos-whats-drikos
Agente de Grupos WhatsApp com IA
