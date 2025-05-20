const db = require('../config/db');
require('dotenv').config();

function telaLogin(req, res) {
  res.render('login.twig');
}

function realizarLogin(req, res) {
  const { usuario, senha } = req.body;
  if (usuario === process.env.LOGIN_USER && senha === process.env.LOGIN_PASSWORD) {
    req.session.user = usuario;
    return res.redirect('/');
  }
  return res.render('login.twig', { erro: 'Credenciais inválidas' });
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

async function listarGrupos(req, res) {
  const [grupos] = await db.execute("SELECT * FROM grupos_config ORDER BY id DESC");
  res.render('grupos.twig', { grupos, erro: req.query.erro });
}

async function telaNovoGrupo(req, res) {
  const id = req.query.id;
  if (id) {
    const [grupo] = await db.execute("SELECT * FROM grupos_config WHERE id = ?", [id]);
    return res.render('novo.twig', { grupo: grupo[0] });
  }
  res.render('novo.twig', { grupo: {} });
}

async function salvarGrupo(req, res) {
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
}

async function excluirGrupo(req, res) {
  const { id } = req.params;
  await db.execute("DELETE FROM grupos_config WHERE id = ?", [id]);
  res.redirect('/');
}

// Integrações Emby

async function telaIntegracaoEmby(req, res) {
  try {
    const [grupos] = await db.execute(
      'SELECT nome_grupo, id_grupo_whatsapp FROM grupos_config'
    );
    res.render('emby.twig', { grupos });
  } catch (err) {
    console.error('Erro ao carregar grupos para integração Emby:', err);
    res.status(500).send('Erro ao carregar tela de integração.');
  }
}

async function salvarIntegracaoEmby(req, res) {
  const { grupo_id, url, api_key, user_id } = req.body;

  if (!grupo_id || !url || !api_key || !user_id) {
    return res.render('emby.twig', {
      erro: '⚠️ Todos os campos são obrigatórios.',
      grupos: await carregarGrupos()
    });
  }

  try {
    // Verifica se já existe uma integração para esse grupo
    const [existe] = await db.execute(
      'SELECT COUNT(*) as total FROM integracoes_emby WHERE grupo_id = ?',
      [grupo_id]
    );

if (existe[0].total > 0) {
  const [grupos] = await db.execute(
    'SELECT nome_grupo, id_grupo_whatsapp FROM grupos_config'
  );
  return res.render('emby.twig', {
    erro: 'duplicado',
    grupos
  });
}


    // Obtém nome do grupo
    const [grupo] = await db.execute(
      'SELECT nome_grupo FROM grupos_config WHERE id_grupo_whatsapp = ?',
      [grupo_id]
    );

    const nome = grupo[0]?.nome_grupo || 'Desconhecido';

    await db.execute(
      'INSERT INTO integracoes_emby (grupo_id, nome, url, api_key, user_id) VALUES (?, ?, ?, ?, ?)',
      [grupo_id, nome, url, api_key, user_id]
    );

    res.redirect('/integracoes/emby');
  } catch (err) {
    console.error('Erro ao salvar integração Emby:', err);
    res.status(500).send('Erro ao salvar integração.');
  }
};

async function carregarGrupos() {
  const [grupos] = await db.execute('SELECT nome_grupo, id_grupo_whatsapp FROM grupos_config');
  return grupos;
}


// ✅ Excluir integração Emby

async function excluirIntegracaoEmby(req, res) {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM integracoes_emby WHERE id = ?', [id]);
    res.redirect('/integracoes/emby');
  } catch (err) {
    console.error('Erro ao excluir integração:', err.message);
    res.status(500).send('Erro ao excluir integração.');
  }
};



async function embyListar(req, res) {
  try {
    const [rows] = await db.execute('SELECT * FROM integracoes_emby ORDER BY criado_em DESC');
    res.render('emby-lista.twig', { integracoes: rows });
  } catch (err) {
    console.error('Erro ao carregar integrações:', err.message);
    res.status(500).send('Erro ao carregar tela de integração.');
  }
}

// ✅ Editar integração Emby
async function editarIntegracaoEmby(req, res) {
  const { id } = req.params;
  try {
    const [grupos] = await db.execute(
      'SELECT nome_grupo, id_grupo_whatsapp FROM grupos_config'
    );

    const [registros] = await db.execute(
      'SELECT * FROM integracoes_emby WHERE id = ?',
      [id]
    );

    if (!registros.length) {
      return res.redirect('/integracoes/emby');
    }

    const integracao = registros[0];

    res.render('emby.twig', {
      grupos,
      integracao,
      editar: true
    });
  } catch (err) {
    console.error('Erro ao carregar integração para edição:', err);
    res.status(500).send('Erro ao carregar tela de edição.');
  }
};


async function atualizarIntegracaoEmby(req, res) {
  const { id } = req.params;
  const { url, api_key, user_id } = req.body;

  if (!url || !api_key || !user_id) {
    return res.status(400).send('Todos os campos são obrigatórios.');
  }

  try {
    await db.execute(
      'UPDATE integracoes_emby SET url=?, api_key=?, user_id=? WHERE id = ?',
      [url, api_key, user_id, id]
    );
    res.redirect('/integracoes/emby');
  } catch (err) {
    console.error('Erro ao atualizar integração Emby:', err);
    res.status(500).send('Erro ao atualizar integração.');
  }
};


// ✅ Exportando tudo corretamente
module.exports = {
  telaLogin,
  realizarLogin,
  logout,
  listarGrupos,
  telaNovoGrupo,
  salvarGrupo,
  excluirGrupo,
  embyListar,
  telaIntegracaoEmby,
  salvarIntegracaoEmby,
  excluirIntegracaoEmby, 
  editarIntegracaoEmby,
  atualizarIntegracaoEmby
};


