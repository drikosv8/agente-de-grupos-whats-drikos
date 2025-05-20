const express = require('express');
const router = express.Router();
const controller = require('../controllers/grupoController');
const { gruposDisponiveis } = require('../gruposData');

// Autenticação e login
router.get('/login', controller.telaLogin);
router.post('/login', controller.realizarLogin);
router.get('/logout', controller.logout);

// Grupos
router.get('/', controller.listarGrupos);
router.get('/novo', controller.telaNovoGrupo);
router.post('/salvar', controller.salvarGrupo);
router.get('/excluir/:id', controller.excluirGrupo);

// Integração Emby
router.get('/integracoes/emby', controller.embyListar);
router.get('/integracoes/emby/novo', controller.telaIntegracaoEmby);
router.post('/salvar-integracao-emby', controller.salvarIntegracaoEmby);
router.get('/integracoes/emby/excluir/:id', controller.excluirIntegracaoEmby);
router.get('/integracoes/emby/editar/:id', controller.editarIntegracaoEmby);
router.post('/atualizar-integracao-emby/:id', controller.atualizarIntegracaoEmby);


// Grupos WhatsApp conectados
router.get('/api/grupos-disponiveis', (req, res) => {
  try {
    if (!Array.isArray(gruposDisponiveis)) {
      console.warn('⚠️ gruposDisponiveis não é um array.');
      return res.json([]);
    }
    return res.json(gruposDisponiveis);
  } catch (err) {
    console.error('❌ Erro na rota /api/grupos-disponiveis:', err);
    return res.status(500).json([]);
  }
});

module.exports = router;
