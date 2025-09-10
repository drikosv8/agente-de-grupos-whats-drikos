const db = require('../config/db');

// 📌 Listar todas as fontes de um grupo
async function listarFontes(req, res) {
  const { grupoId } = req.params;

  try {
    const [grupoRows] = await db.execute(
      'SELECT * FROM grupos_config WHERE id = ?',
      [grupoId]
    );

    if (!grupoRows.length) {
      return res.status(404).send('Grupo não encontrado.');
    }

    const grupo = {
      id: grupoRows[0].id || grupoRows[0].ID,
      nome_grupo: grupoRows[0].nome_grupo,
    };

    const [fontes] = await db.execute(
      'SELECT * FROM fontes_dados_externos WHERE grupo_id = ? ORDER BY criado_em DESC',
      [grupo.id]
    );

    res.render('dados-externos.twig', { grupo, fontes, habilitado: true });
  } catch (err) {
    console.error('[❌ ERRO] listarFontes:', err.message);
    res.status(500).send('Erro ao carregar fontes.');
  }
}

// 🔹 Helper para montar conexão sempre com todas as chaves
function montarConexao(body) {
  const raw =
    body.conexao && typeof body.conexao === 'object'
      ? body.conexao
      : {
          host: body['conexao[host]'],
          port: body['conexao[port]'],
          user: body['conexao[user]'],
          password: body['conexao[password]'],
          database: body['conexao[database]'],
        };

  return {
    host: raw.host || '',
    port: raw.port || '',
    user: raw.user || '',
    password: raw.password || '',
    database: raw.database || '',
  };
}

// 📌 Criar nova fonte
async function salvarFonte(req, res) {
  const grupo_id = req.body.grupo_id || req.params.grupoId;
  const { tipo, descricao, tabela, colunas, instrucoes_ativacao } = req.body;
  const conexao = montarConexao(req.body);

  // 🔹 Validação obrigatória
  if (!grupo_id || !tipo || !descricao || !tabela || !colunas ||
      !conexao.host || !conexao.port || !conexao.user || !conexao.password || !conexao.database) {
    return res.status(400).send('Todos os campos obrigatórios devem ser preenchidos.');
  }

  try {
    await db.execute(
      `INSERT INTO fontes_dados_externos 
        (grupo_id, tipo, descricao, tabela, colunas, instrucoes_ativacao, conexao, habilitado) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        parseInt(grupo_id, 10),
        tipo,
        descricao,
        tabela,
        colunas,
        instrucoes_ativacao || null,
        JSON.stringify(conexao),
      ]
    );

    res.redirect(`/grupos/${grupo_id}/fontes`);
  } catch (err) {
    console.error('[❌ ERRO] salvarFonte:', err.message);
    res.status(500).send('Erro ao salvar a fonte.');
  }
}
// 📌 Atualizar fonte existente
async function atualizarFonte(req, res) {
  const { id } = req.params;
  const grupo_id = req.body.grupo_id || req.params.grupoId;
  const conexao = montarConexao(req.body);

  // 🔹 Validação obrigatória
  if (!grupo_id || !req.body.tipo || !req.body.descricao || !req.body.tabela || !req.body.colunas ||
      !conexao.host || !conexao.port || !conexao.user || !conexao.password || !conexao.database) {
    return res.status(400).send('Todos os campos obrigatórios devem ser preenchidos.');
  }

  try {
    await db.execute(
      `UPDATE fontes_dados_externos 
       SET tipo=?, descricao=?, tabela=?, colunas=?, instrucoes_ativacao=?, conexao=? 
       WHERE id=?`,
      [
        req.body.tipo,
        req.body.descricao,
        req.body.tabela,
        req.body.colunas,
        req.body.instrucoes_ativacao || null,
        JSON.stringify(conexao),
        id,
      ]
    );

    res.redirect(`/grupos/${grupo_id}/fontes`);
  } catch (err) {
    console.error('[❌ ERRO] atualizarFonte:', err.message);
    res.status(500).send('Erro ao atualizar a fonte.');
  }
}

// 📌 Tela de nova fonte
async function novaFonte(req, res) {
  const { grupoId } = req.params;
  try {
    const [grupoRows] = await db.execute('SELECT * FROM grupos_config WHERE id = ?', [grupoId]);
    if (!grupoRows.length) return res.status(404).send('Grupo não encontrado.');

    res.render('form-fonte.twig', {
      grupo: { id: grupoRows[0].id },
      fonte: null,
      conexao: { host: '', port: '', user: '', password: '', database: '' }
    });
  } catch (err) {
    console.error('[❌ ERRO] novaFonte:', err.message);
    res.status(500).send('Erro ao carregar formulário de nova fonte.');
  }
}

// 📌 Tela de edição de fonte
async function editarFonte(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM fontes_dados_externos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).send('Fonte não encontrada.');

    const fonte = rows[0];
    let conexao = {};

    try {
      conexao = typeof fonte.conexao === 'string'
        ? JSON.parse(fonte.conexao || '{}')
        : (fonte.conexao || {});
    } catch (e) {
      console.error('❌ Erro ao parsear conexao:', e.message);
      conexao = {};
    }

    res.render('form-fonte.twig', {
      grupo: { id: fonte.grupo_id },
      fonte,
      conexao: {
        host: conexao.host ?? '',
        port: conexao.port ?? '',
        user: conexao.user ?? '',
        password: conexao.password ?? '',
        database: conexao.database ?? ''
      }
    });
  } catch (err) {
    console.error('[❌ ERRO] editarFonte:', err.message);
    res.status(500).send('Erro ao carregar fonte.');
  }
}

// 📌 Excluir fonte
async function excluirFonte(req, res) {
  const { id } = req.body;
  const { grupoId } = req.params;

  if (!id) {
    return res.status(400).send('ID da fonte não informado.');
  }

  try {
    await db.execute('DELETE FROM fontes_dados_externos WHERE id = ?', [id]);

    // 🔹 Redireciona corretamente para a lista de fontes
    res.redirect(`/grupos/${grupoId}/fontes`);
  } catch (err) {
    console.error('[❌ ERRO] excluirFonte:', err.message);
    res.status(500).send('Erro ao excluir a fonte.');
  }
}

// 📌 Ativar/Desativar fonte
async function toggleFonte(req, res) {
  const { id } = req.body;
  const { grupoId } = req.params;

  if (!id) {
    return res.status(400).send('ID da fonte não informado.');
  }

  try {
    const [rows] = await db.execute(
      'SELECT habilitado FROM fontes_dados_externos WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).send('Fonte não encontrada.');
    }

    const novoStatus = rows[0].habilitado ? 0 : 1;

    await db.execute(
      'UPDATE fontes_dados_externos SET habilitado = ? WHERE id = ?',
      [novoStatus, id]
    );

    // 🔹 Redireciona corretamente para a lista de fontes
    res.redirect(`/grupos/${grupoId}/fontes`);
  } catch (err) {
    console.error('[❌ ERRO] toggleFonte:', err.message);
    res.status(500).send('Erro ao atualizar status da fonte.');
  }
}





// ✅ Exportar todas as funções
module.exports = {
  listarFontes,
  salvarFonte,
  novaFonte,
  editarFonte,
  atualizarFonte,
  excluirFonte,
  toggleFonte,
};