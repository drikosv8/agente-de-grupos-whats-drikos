const db = require('../config/db');
require('dotenv').config();

exports.telaLogin = (req, res) => res.render('login.twig');

exports.realizarLogin = (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === process.env.LOGIN_USER && senha === process.env.LOGIN_PASSWORD) {
    req.session.user = usuario;
    return res.redirect('/');
  }
  return res.render('login.twig', { erro: 'Credenciais inválidas' });
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/login'));

exports.listarGrupos = async (req, res) => {
  const [grupos] = await db.execute("SELECT * FROM grupos_config ORDER BY id DESC");
  res.render('grupos.twig', { grupos, erro: req.query.erro });
};

exports.telaNovoGrupo = async (req, res) => {
  const id = req.query.id;
  if (id) {
    const [grupo] = await db.execute("SELECT * FROM grupos_config WHERE id = ?", [id]);
    return res.render('novo.twig', { grupo: grupo[0] });
  }
  res.render('novo.twig', { grupo: {} });
};

exports.salvarGrupo = async (req, res) => {
  // Sanitização para remover espaços antes e depois
  const id = (req.body.id || '').trim();
  const nome_grupo = (req.body.nome_grupo || '').trim();
  const nome_bot = (req.body.nome_bot || '').trim();
  const id_grupo_whatsapp = (req.body.id_grupo_whatsapp || '').trim();
  const fuso_horario = (req.body.fuso_horario || '').trim();
  const voz_ai = (req.body.voz_ai || '').trim();
  const modelo_ai = (req.body.modelo_ai || '').trim();
  const comportamento = (req.body.comportamento || '').trim();
  const openai_api_key = (req.body.openai_api_key || '').trim();

  try {
    if (id !== '') {
      await db.execute(
        `UPDATE grupos_config SET nome_grupo=?, nome_bot=?, id_grupo_whatsapp=?, fuso_horario=?, voz_ai=?, modelo_ai=?, comportamento=?, openai_api_key=? WHERE id=?`,
        [nome_grupo, nome_bot, id_grupo_whatsapp, fuso_horario, voz_ai, modelo_ai, comportamento, openai_api_key, id]
      );
    } else {
      await db.execute(
        `INSERT INTO grupos_config (nome_grupo, nome_bot, id_grupo_whatsapp, fuso_horario, voz_ai, modelo_ai, comportamento, openai_api_key) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome_grupo, nome_bot, id_grupo_whatsapp, fuso_horario, voz_ai, modelo_ai, comportamento, openai_api_key]
      );
    }
    res.redirect('/');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.redirect('/?erro=duplicado');
    }
    return res.redirect('/?erro=geral');
  }
};

exports.excluirGrupo = async (req, res) => {
  const { id } = req.params;
  await db.execute("DELETE FROM grupos_config WHERE id = ?", [id]);
  res.redirect('/');
};
