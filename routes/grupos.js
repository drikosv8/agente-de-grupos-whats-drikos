const express = require('express');
const router = express.Router();
const controller = require('../controllers/grupoController');
const { gruposDisponiveis } = require('../gruposData');

router.get('/login', controller.telaLogin);
router.post('/login', controller.realizarLogin);
router.get('/logout', controller.logout);
router.get('/', controller.listarGrupos);
router.get('/novo', controller.telaNovoGrupo);
router.post('/salvar', controller.salvarGrupo);
router.get('/excluir/:id', controller.excluirGrupo);

// ✅ Rota para retornar grupos do WhatsApp já conectados
router.get('/api/grupos-disponiveis', (req, res) => {
  try {
    if (!Array.isArray(gruposDisponiveis)) {
      console.warn('⚠️ gruposDisponiveis não é um array.');
      return res.json([]);
    }

    // Força retorno JSON mesmo que vazio
    return res.json(gruposDisponiveis);
  } catch (err) {
    console.error('❌ Erro na rota /api/grupos-disponiveis:', err);
    return res.status(500).json([]);
  }
});

module.exports = router;
