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
  const grupo = msg.from || msg.grupo || msg.to || 'BOT';
  const corpo = msg.body || msg.mensagem || '[vazio]';
  const isGrupo = grupo.endsWith('@g.us');

  let autor = msg.author || msg.from || 'BOT';
  let nomeContato = autor;

  if (isGrupo && msg.author) {
    try {
      const contato = await msg.getContact();
      nomeContato = contato.pushname || contato.name || autor.split('@')[0];
    } catch (e) {}
  } else if (!isGrupo) {
    try {
      const contato = await msg.getContact();
      nomeContato = contato.pushname || contato.name || autor.split('@')[0];
    } catch (e) {}
  }

  await connection.execute(
    'INSERT INTO mensagens (grupo, autor, mensagem) VALUES (?, ?, ?)',
    [grupo, nomeContato, corpo]
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

  return rows.map(r =>
    `📅 ${moment(r.data).format('HH:mm')} - 👤 ${r.autor}: ${r.mensagem}`
  ).join('\n');
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

  return rows.map(r => `- *${r.autor}:* ${r.mensagem}`).join('\n');
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

  return rows.map(r =>
    `👤 ${r.autor} (${moment(r.data).format('DD/MM - HH:mm')}):\n"${r.mensagem}"`
  ).join('\n\n');
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

async function buscarIntegracaoEmbyPorGrupo(grupo_id) {
  const [rows] = await connection.execute(
    'SELECT * FROM integracoes_emby WHERE grupo_id = ? LIMIT 1',
    [grupo_id]
  );
  return rows[0] || null;
}

module.exports = {
  salvarMensagem,
  buscarContextoDoGrupoHoje,
  buscarResumoDoDia,
  buscarPorTermoNoBanco,
  buscarResumo30Dias,
  buscarConfiguracaoDoGrupo,
  buscarIntegracaoEmbyPorGrupo
};
