exports.salvarGrupo = async (req, res) => {
  try {
    const {
      id,
      nome_grupo,
	  nome_bot,
      id_grupo_whatsapp,
      fuso_horario,
      voz_ai,
      modelo_ai,
      comportamento,
      openai_api_key
    } = req.body;

    // Aplica trim na chave (e se quiser, nos outros campos também)
    const chaveLimpa = openai_api_key.trim();

    if (id) {
      await db.connection.execute(
        `UPDATE grupos_config
         SET nome_grupo=?, nome_bot=?, id_grupo_whatsapp=?, fuso_horario=?, voz_ai=?, modelo_ai=?, comportamento=?, openai_api_key=?
         WHERE id=?`,
        [nome_grupo, nome_bot, id_grupo_whatsapp, fuso_horario, voz_ai, modelo_ai, comportamento, chaveLimpa, id]
      );
    } else {
      await db.connection.execute(
        `INSERT INTO grupos_config (nome_grupo, nome_bot, id_grupo_whatsapp, fuso_horario, voz_ai, modelo_ai, comportamento, openai_api_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome_grupo, nome_bot, id_grupo_whatsapp, fuso_horario, voz_ai, modelo_ai, comportamento, chaveLimpa]
      );
    }

    res.redirect('/grupos');
  } catch (error) {
    console.error('Erro ao salvar grupo:', error);
    res.status(500).send('Erro ao salvar grupo');
  }
};
