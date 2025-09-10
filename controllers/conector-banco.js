// 📁 conector-banco.js — versão do projeto grupos com fontes_dados_externos

const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');
const mssql = require('mssql');
const axios = require('axios');
const db = require('../config/db'); // nossa pool MySQL principal
const modelo = process.env.MODELO_AI || 'gpt-4o-mini';

/**
 * Decide via IA se deve consultar uma fonte com base na instrução e pergunta do usuário.
 */
async function decidirSeConsulta(pergunta, instrucao, apiKey) {
  try {
    const resposta = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: modelo,
        messages: [
          { role: 'system', content: 'Você é um assistente que decide se uma pergunta exige consultar uma base de dados.' },
          { role: 'user', content: `Instrução:\n${instrucao}\n\nPergunta:\n${pergunta}\n\nResponda apenas com "sim" ou "nao".` }
        ],
        temperature: 0
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const texto = resposta.data.choices?.[0]?.message?.content?.toLowerCase().trim();
    return texto.includes('sim');
  } catch (e) {
    console.error('[⚠️ IA-Conector] Erro ao decidir se consulta:', e.message);
    return false;
  }
}

/**
 * Detecta colunas do tipo data e aplica formatação adequada.
 */
async function obterColunasFormatadas(tipo, conn, tabela, colunasOriginais) {
  const formatadores = {
    mssql: col => `FORMAT(${col}, 'yyyy-MM-dd') AS ${col}`,
    postgres: col => `to_char(${col}, 'YYYY-MM-DD') AS ${col}`,
    mysql: col => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${col}`
  };
  const formatar = formatadores[tipo];
  const campos = [];

  try {
    let rows = [];
    if (tipo === 'mysql') {
      const pool = await mysql.createPool(conn);
      [rows] = await pool.query(
        `SELECT COLUMN_NAME, DATA_TYPE 
         FROM information_schema.columns 
         WHERE table_name = ? AND table_schema = ?`,
        [tabela, conn.database]
      );
      await pool.end();
    } else if (tipo === 'postgres') {
      const client = new PgClient(conn);
      await client.connect();
      const res = await client.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1 AND table_schema = 'public'`,
        [tabela]
      );
      rows = res.rows;
      await client.end();
    } else if (tipo === 'mssql') {
      const connFormatada = {
        server: conn.server || conn.host,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        port: parseInt(conn.port || '1433'),
        options: { encrypt: false, trustServerCertificate: true }
      };
      const pool = await mssql.connect(connFormatada);
      const res = await pool.request().query(
        `SELECT COLUMN_NAME, DATA_TYPE 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_NAME = '${tabela}'`
      );
      rows = res.recordset;
      await pool.close();
    }

    const nomesData = new Set(
      rows
        .filter(r => `${r.DATA_TYPE || r.data_type}`.toLowerCase().includes('date'))
        .map(r => `${r.COLUMN_NAME || r.column_name}`.toLowerCase())
    );

    const originais = colunasOriginais.split(',').map(c => c.trim());

    for (const col of originais) {
      const nomeOriginal = col.toLowerCase().includes(' as ')
        ? col.split(' as ')[0].trim()
        : col.trim();
      const nomeLimpo = nomeOriginal.includes('.')
        ? nomeOriginal.split('.').pop()
        : nomeOriginal;

      campos.push(nomesData.has(nomeLimpo.toLowerCase()) ? formatar(nomeOriginal) : col);
    }
  } catch (err) {
    console.error('[❌ ERRO] Falha ao detectar colunas da tabela:', err.message);
    return colunasOriginais;
  }

  return campos.join(', ');
}

/**
 * Executa consultas em todas as fontes vinculadas a um grupo.
 */
async function executarConsultas(grupoId, pergunta) {
  try {
    // 🔹 Busca fontes vinculadas
    const [fontes] = await db.execute(
      'SELECT * FROM fontes_dados_externos WHERE grupo_id = ? AND habilitado = 1',
      [grupoId]
    );

    if (!fontes.length) {
      console.log(`[ℹ️ FONTES] Nenhuma fonte habilitada para o grupo ${grupoId}`);
      return '';
    }

    // 🔹 Busca a chave correta do grupo
    const [grupoRows] = await db.execute(
      'SELECT openai_api_key FROM grupos_config WHERE id = ?',
      [grupoId]
    );

    if (!grupoRows.length || !grupoRows[0].openai_api_key) {
      console.warn(`⚠️ Grupo ${grupoId} não possui chave OpenAI configurada.`);
      return '';
    }

    const apiKey = grupoRows[0].openai_api_key;
    const results = [];

    for (const f of fontes) {
      const tipo = f.tipo;

      // 🔹 Parse seguro da conexão
      let conn = {};
      try {
        conn = typeof f.conexao === 'string'
          ? JSON.parse(f.conexao || '{}')
          : (f.conexao || {});
      } catch (e) {
        console.error(`❌ Erro ao parsear conexão da fonte "${f.descricao}":`, e.message);
        continue; // pula essa fonte
      }

      let colunas = f.colunas || '*';
      const tabela = f.tabela;

      if (!tabela || !conn) {
        console.warn(`⚠️ Fonte "${f.descricao}" ignorada (sem tabela ou conexão).`);
        continue;
      }

      // decidir se consulta
      if (f.instrucoes_ativacao && pergunta) {
        const deveConsultar = await decidirSeConsulta(pergunta, f.instrucoes_ativacao, apiKey);
        if (!deveConsultar) {
          console.log(`[ℹ️ SKIP] Pergunta: "${pergunta}" → NÃO acionou a fonte "${f.descricao}"`);
          continue;
        }
        console.log(`[🔍 CONSULTA ATIVADA] Fonte: ${f.descricao} (${tipo.toUpperCase()})`);
        console.log(`   ↪️ Pergunta do usuário: "${pergunta}"`);
        console.log(`   ↪️ Motivo: Instrução da fonte "${f.instrucoes_ativacao}"`);
      } else {
        console.log(`[🔍 CONSULTA DIRETA] Fonte: ${f.descricao} (${tipo.toUpperCase()})`);
      }

      // formata colunas se necessário
      if (colunas !== '*') {
        colunas = await obterColunasFormatadas(tipo, conn, tabela, colunas);
      }

      const sql = `SELECT ${colunas} FROM ${tabela}`;
      let rows = [];

      try {
        if (tipo === 'mysql') {
          const pool = await mysql.createPool(conn);
          [rows] = await pool.query(sql);
          await pool.end();
        } else if (tipo === 'postgres') {
          const client = new PgClient(conn);
          await client.connect();
          const res = await client.query(sql);
          rows = res.rows;
          await client.end();
        } else if (tipo === 'mssql') {
          const connFormatada = {
            server: conn.server || conn.host,
            user: conn.user,
            password: conn.password,
            database: conn.database,
            port: parseInt(conn.port || '1433'),
            options: { encrypt: false, trustServerCertificate: true }
          };
          const pool = await mssql.connect(connFormatada);
          const res = await pool.request().query(sql);
          rows = res.recordset;
          await pool.close();
        }

        if (rows.length > 0) {
          let bloco = `📊 ${f.descricao}\n`;
          rows.forEach(r => {
            Object.entries(r).forEach(([k, v]) => {
              bloco += `• ${k}: ${v}\n`;
            });
            bloco += '\n';
          });

          results.push(bloco.trim());
        } else {
          console.log(`ℹ️ Fonte "${f.descricao}" não retornou linhas.`);
        }
      } catch (err) {
        console.error(`[❌ ERRO] Consulta da fonte "${f.descricao}" falhou:`, err.message);
      }
    }

    return results.join('\n\n');
  } catch (err) {
    console.error('[❌ ERRO] executarConsultas:', err.message);
    return '';
  }
}



module.exports = { executarConsultas };
