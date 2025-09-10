const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const controller = require('../controllers/grupoController');
const { gruposDisponiveis } = require('../gruposData');

// Autenticação e login
=======

const controller = require('../controllers/grupoController');
const { gruposDisponiveis } = require('../gruposData');
const dadosExternosController = require('../controllers/dadosExternosController');

// ======================
// Autenticação e login
// ======================
>>>>>>> 90e442b (Novidade e melhorias)
router.get('/login', controller.telaLogin);
router.post('/login', controller.realizarLogin);
router.get('/logout', controller.logout);

<<<<<<< HEAD
// Grupos
=======
// ======================
// Grupos
// ======================
>>>>>>> 90e442b (Novidade e melhorias)
router.get('/', controller.listarGrupos);
router.get('/novo', controller.telaNovoGrupo);
router.post('/salvar', controller.salvarGrupo);
router.get('/excluir/:id', controller.excluirGrupo);

<<<<<<< HEAD
// Integração Emby
=======
// ======================
// Integração Emby
// ======================
>>>>>>> 90e442b (Novidade e melhorias)
router.get('/integracoes/emby', controller.embyListar);
router.get('/integracoes/emby/novo', controller.telaIntegracaoEmby);
router.post('/salvar-integracao-emby', controller.salvarIntegracaoEmby);
router.get('/integracoes/emby/excluir/:id', controller.excluirIntegracaoEmby);
router.get('/integracoes/emby/editar/:id', controller.editarIntegracaoEmby);
router.post('/atualizar-integracao-emby/:id', controller.atualizarIntegracaoEmby);

<<<<<<< HEAD

// Grupos WhatsApp conectados
=======
// ======================
// Fontes de Dados Externos
// ======================

// Listar fontes de um grupo
router.get('/grupos/:grupoId/fontes', dadosExternosController.listarFontes);

// Nova fonte (tela de cadastro)
router.get('/grupos/:grupoId/fontes/novo', dadosExternosController.novaFonte);

// Salvar nova fonte
router.post('/grupos/:grupoId/fontes/salvar', dadosExternosController.salvarFonte);

// Editar fonte (tela de edição)
router.get('/grupos/:grupoId/fontes/editar/:id', dadosExternosController.editarFonte);

// Atualizar fonte existente
router.post('/grupos/:grupoId/fontes/atualizar/:id', dadosExternosController.atualizarFonte);

// Excluir fonte
router.post('/grupos/:grupoId/fontes/excluir', dadosExternosController.excluirFonte);

// Ativar/Desativar fonte
router.post('/grupos/:grupoId/fontes/toggle', dadosExternosController.toggleFonte);


// ======================
// Grupos WhatsApp conectados (API interna)
// ======================
>>>>>>> 90e442b (Novidade e melhorias)
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
