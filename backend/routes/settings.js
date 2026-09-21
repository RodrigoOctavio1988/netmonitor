/**
 * settings.js — Rotas REST para Health Check, Info de Rede e Configurações
 */
const express = require('express');
const router  = express.Router();
const logger  = require('../logger');
const { detectLocalNetworkRange } = require('../utils/ipUtils');
const { setIntervalSec, getIntervalSec, startActiveMonitoring } = require('../services/pingService');
const { requireRole } = require('../middleware/auth');
const db      = require('../db/database');

const MAX_DEVICES  = parseInt(process.env.MAX_DEVICES || '50', 10);
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

// GET /api/health — Status da aplicação
router.get('/health', (req, res) => {
  res.json({
    status:     'ok',
    auth:       AUTH_ENABLED,
    version:    '3.0.0',
    maxDevices: MAX_DEVICES,
    dbType:     'SQLite'
  });
});

// GET /api/network-info — Faixa de IP local detectada
router.get('/network-info', (req, res) => {
  res.json(detectLocalNetworkRange());
});

// POST /api/settings — Altera intervalo de monitoramento (Apenas Admin)
router.post('/settings', requireRole('admin'), (req, res) => {
  const { interval } = req.body;
  if (interval && !isNaN(interval)) {
    const intervalSec = parseInt(interval, 10);
    const success     = setIntervalSec(intervalSec);
    if (success) {
      logger.info(`Intervalo de monitoramento atualizado para: ${intervalSec}s`);
      
      // Notifica os clientes via WS se a função de broadcast estiver anexada
      if (req.app.locals.broadcast) {
        req.app.locals.broadcast({ type: 'settings-update', interval: intervalSec });
      }

      // Reinicia o loop de monitoramento com o novo intervalo
      startActiveMonitoring(
        () => db.getAllDevices(),
        data => req.app.locals.broadcast && req.app.locals.broadcast(data)
      );

      return res.json({ success: true, interval: intervalSec });
    }
  }
  res.status(400).json({ error: 'Intervalo inválido. Deve ser entre 1 e 300 segundos.' });
});

// GET /api/settings/db-stats — Informações de disco e volume do banco
router.get('/settings/db-stats', (req, res) => {
  try {
    const stats = db.getDbStats ? db.getDbStats() : { dbType: 'Unknown', sizeMb: '0.00 MB' };
    res.json(stats);
  } catch (err) {
    logger.error('Erro ao buscar stats do banco:', err.message);
    res.status(500).json({ error: 'Erro ao buscar estatísticas do banco.' });
  }
});

// POST /api/settings/purge — Otimiza e purga histórico antigo do SQLite (Apenas Admin)
router.post('/settings/purge', requireRole('admin'), (req, res) => {
  try {
    const days = parseInt(req.body.days || '30', 10);
    const result = db.purgeOldRecords ? db.purgeOldRecords(days) : { success: true };
    res.json(result);
  } catch (err) {
    logger.error('Erro ao executar purge do banco:', err.message);
    res.status(500).json({ error: 'Erro ao executar limpeza do banco de dados.' });
  }
});

module.exports = router;
