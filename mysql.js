require('dotenv').config();
const mysql = require('mysql2/promise');
const moment = require('moment');

const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function salvarMensagem(msg) {
  const autor = msg.author || msg.from || 'BOT';
  const corpo = msg.body || msg.mensagem || '[vazio]';
  const grupo = msg.from || msg.grupo || msg.to || 'BOT';

  await connection.execute(
    'INSERT INTO mensagens (grupo, autor, mensagem) VALUES (?, ?, ?)',
    [grupo, autor, corpo]
  );
}

async function buscarContextoDoGrupoHoje(grupo) {
  const hoje = moment().format('YYYY-MM-DD');
  const [rows] = await connection.execute(
    `SELECT autor, mensagem, data 
     FROM mensagens 
     WHERE grupo = ? AND DATE(data) = ? 
     ORDER BY data ASC`,
    [grupo, hoje]
  );
  return rows.map(r => `📅 ${moment(r.data).format('HH:mm')} - 👤 ${r.autor}: ${r.mensagem}`).join('\n');
}

async function buscarResumoDoDia(grupo, dataReferencia) {
  const dataFormatada = moment(dataReferencia, 'YYYY-MM-DD').format('YYYY-MM-DD');
  const [rows] = await connection.execute(
    `SELECT autor, mensagem 
     FROM mensagens 
     WHERE grupo = ? AND DATE(data) = ? 
     ORDER BY data ASC`,
    [grupo, dataFormatada]
  );
  return rows.map(r => `- ${r.autor}: ${r.mensagem}`).join('\n');
}

async function buscarPorTermoNoBanco(grupo, termo) {
  const termoLike = `%${termo}%`;
  const [rows] = await connection.execute(
    `SELECT autor, mensagem, data 
     FROM mensagens 
     WHERE grupo = ? AND LOWER(mensagem) LIKE LOWER(?) 
       AND LOWER(mensagem) NOT LIKE '/buscar%' 
     ORDER BY data DESC 
     LIMIT 30`,
    [grupo, termoLike]
  );

  console.log(`[DEBUG] /buscar encontrou ${rows.length} resultados para: "${termo}"`);
  if (!rows.length) return null;

  return rows.map(r => {
    const data = moment(r.data).format('DD/MM - HH:mm');
    const autor = r.autor.replace('@c.us', '');
    return `👤 ${autor} (${data}):\n"${r.mensagem}"`;
  }).join('\n\n');
}

async function buscarResumo30Dias(grupo, termo) {
  const limite = moment().subtract(30, 'days').format('YYYY-MM-DD');
  const [rows] = await connection.execute(
    `SELECT autor, mensagem 
     FROM mensagens 
     WHERE grupo = ? AND LOWER(mensagem) LIKE LOWER(?) 
       AND data >= ? 
     ORDER BY data ASC`,
    [grupo, `%${termo}%`, limite]
  );
  return rows.map(r => `- ${r.autor}: ${r.mensagem}`).join('\n');
}

async function buscarConfiguracaoDoGrupo(idGrupoWhatsapp) {
  const [rows] = await connection.execute(
    'SELECT * FROM grupos_config WHERE id_grupo_whatsapp = ?',
    [idGrupoWhatsapp]
  );
  if (rows.length === 0) {
    console.warn(`⚠️ Configuração não encontrada para o grupo: ${idGrupoWhatsapp}`);
  }
  return rows[0] || null;
}

module.exports = {
  salvarMensagem,
  buscarContextoDoGrupoHoje,
  buscarResumoDoDia,
  buscarPorTermoNoBanco,
  buscarResumo30Dias,
  buscarConfiguracaoDoGrupo // ✅ ESSENCIAL para funcionar no index.js
};
