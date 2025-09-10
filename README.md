# 🤖 Agente IA para Grupos de WhatsApp

Este projeto é um sistema completo de múltiplos agentes para grupos do WhatsApp com uso de **IA personalizada**, baseado em **OpenAI GPT**, TTS, Whisper e interpretação de imagem.  
Cada grupo possui **comportamento isolado**, com chave de API, voz, modelo distintos, e ainda pode ter **fontes de dados externas** vinculadas (SQL Server, MySQL, PostgreSQL) para pesquisas inteligentes.

Tenha um único número de Agente Robô em vários grupos do WhatsApp com **personalidades e contextos diferentes**, enviando e recebendo mensagens de texto, áudio e imagem.

### 📌 Exemplos de uso
- Resumir assuntos que rolaram no grupo ontem, hoje ou na última semana.  
- Pedir para o robô responder perguntas por texto ou áudio.  
- Interpretar imagens enviadas no grupo.  
- Pesquisar palavras-chave e recuperar mensagens relacionadas, mesmo que já tenham sido apagadas.  

📢 **Novidade (20/05/2025):** Integração com servidor **Emby**, permitindo consultas de filmes e séries (título, capa, ano, gênero, sinopse, etc.), com suporte a múltiplos servidores configuráveis.

---

## ✨ Funcionalidades

- 🧠 Memória e contexto por grupo (sem misturar dados).  
- 📣 Respostas por voz com TTS customizado.  
- 🤖 Escolha de modelo OpenAI por grupo (gpt-4o, gpt-3.5-turbo, etc.).  
- 🌍 Fuso horário individual configurável.  
- 🎙️ Transcrição automática de áudios (Whisper).  
- 🖼️ Interpretação de imagens via GPT-4o Vision.  
- 🔗 Conexão com múltiplos bancos (SQL Server, MySQL, PostgreSQL).  
- 💻 Painel Web moderno com login seguro.  
- 🔒 Acesso restrito apenas para grupos cadastrados.  
- 🧾 Histórico de mensagens salvo por grupo no banco.  
- 📺 Integração com servidor **Emby** para consulta de mídias.  

---

## 💬 Comandos Disponíveis

```bash
@nome_do_bot sua pergunta
/buscar palavra-chave
/resumo hoje
/resumo ontem
/resumo semana
/filme titulo
/serie titulo
```

🎤 Áudios → são transcritos automaticamente.  
🖼️ Imagens → são interpretadas com descrição detalhada.  

---

## 🛡️ Segurança

- Apenas grupos cadastrados em `grupos_config` podem interagir.  
- Cada grupo possui sua própria chave OpenAI e contexto.  
- Nenhuma requisição à OpenAI é feita sem validação do grupo.  

---

## 🧩 Requisitos

- Node.js 18+  
- MySQL 8+ (com suporte a fontes adicionais: SQL Server, PostgreSQL).  
- Conta e chave da API OpenAI.  
- WhatsApp autenticado para gerar QRCode.  

---

## ⚙️ Instalação

Clone o repositório:

```bash
git clone https://github.com/drikosv8/agente-de-grupos-whats-drikos.git
cd agente-de-grupos-whats-drikos
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env`:

```ini
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

Inicie o sistema:

```bash
node index.js
```

👉 Acesse no navegador: [http://localhost:8000](http://localhost:8000)  
Faça login com as credenciais do `.env`.

---

## 🗃️ Estrutura do Banco de Dados (MySQL)

```sql
-- Banco de dados principal
CREATE DATABASE IF NOT EXISTS `agente_ia_grupo`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `agente_ia_grupo`;

-- Configuração de grupos
CREATE TABLE `grupos_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome_grupo` VARCHAR(255),
  `nome_bot` VARCHAR(100),
  `id_grupo_whatsapp` VARCHAR(100) UNIQUE,
  `fuso_horario` VARCHAR(100),
  `voz_ai` VARCHAR(50),
  `modelo_ai` VARCHAR(50),
  `comportamento` TEXT,
  `openai_api_key` TEXT,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Histórico de mensagens
CREATE TABLE `mensagens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `grupo` VARCHAR(255),
  `autor` VARCHAR(255),
  `mensagem` TEXT,
  `data` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Integração com servidores Emby
CREATE TABLE `integracoes_emby` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `grupo_id` VARCHAR(100) NOT NULL,
  `nome` VARCHAR(100),
  `url` TEXT NOT NULL,
  `api_key` TEXT NOT NULL,
  `user_id` VARCHAR(100) NOT NULL,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Fontes de dados externas
CREATE TABLE `fontes_dados_externos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `grupo_id` INT NOT NULL,
  `tipo` VARCHAR(20) NOT NULL,
  `descricao` VARCHAR(255) NOT NULL,
  `tabela` VARCHAR(255) NOT NULL,
  `colunas` TEXT NOT NULL,
  `instrucoes_ativacao` TEXT,
  `conexao` JSON NOT NULL,
  `habilitado` TINYINT(1) DEFAULT 1,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`grupo_id`) REFERENCES grupos_config(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

## 🛠️ Tecnologias Utilizadas

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)  
- [OpenAI API](https://platform.openai.com/docs)  
- [Express.js](https://expressjs.com/)  
- [Twig.js](https://github.com/twigjs/twig.js)  
- [Bootstrap 5](https://getbootstrap.com/)  
- [Moment.js](https://momentjs.com/)  
- MySQL, SQL Server, PostgreSQL  

---

## 🪪 Licença

MIT © [Driko's v8]  
🔗 https://griteplay.eu.org/dev

---

☕ **Gostou do projeto? Me pague um café!**  
Se este projeto foi útil para você, considere apoiar com um café. 😄  
📩 **Pix**: adriano.p.oliveira85@gmail.com
