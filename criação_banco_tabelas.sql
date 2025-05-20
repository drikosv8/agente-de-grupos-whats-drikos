-- Criação do banco de dados
CREATE DATABASE IF NOT EXISTS `agente_ia_grupo`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `agente_ia_grupo`;

-- --------------------------------------------------------
-- Tabela: grupos_config
-- --------------------------------------------------------

DROP TABLE IF EXISTS `grupos_config`;

CREATE TABLE `grupos_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome_grupo` varchar(255) DEFAULT NULL,
  `nome_bot` varchar(100) DEFAULT NULL,
  `id_grupo_whatsapp` varchar(100) DEFAULT NULL,
  `fuso_horario` varchar(100) DEFAULT NULL,
  `voz_ai` varchar(50) DEFAULT NULL,
  `modelo_ai` varchar(50) DEFAULT NULL,
  `comportamento` text,
  `openai_api_key` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_grupo_whatsapp` (`id_grupo_whatsapp`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Tabela: mensagens
-- --------------------------------------------------------

DROP TABLE IF EXISTS `mensagens`;

CREATE TABLE `mensagens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grupo` varchar(255) DEFAULT NULL,
  `autor` varchar(255) DEFAULT NULL,
  `mensagem` text,
  `data` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=493 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- --------------------------------------------------------
-- Tabela: integracoes_emby
-- --------------------------------------------------------

CREATE TABLE integracoes_emby (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id VARCHAR(100) NOT NULL,
  nome VARCHAR(100),
  url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
