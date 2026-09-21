/**
 * alerts.js — Rotas REST para Sistema de Alertas
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireRole } = require('../middleware/auth');

// GET /api/alerts — Lista paginada de alertas
router.get('/alerts', (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  try {
    const alerts = db.getAlerts ? db.getAlerts(limit) : [];
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar alertas.' });
  }
});

// PUT /api/alerts/:id/read — Marcar alerta como lido
router.put('/alerts/:id/read', (req, res) => {
  try {
    if (db.markAlertRead) {
      db.markAlertRead(req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao marcar alerta.' });
  }
});

// PUT /api/alerts/read-all — Marcar todos como lidos
router.put('/alerts/read-all', (req, res) => {
  try {
    if (db.markAllAlertsRead) {
      db.markAllAlertsRead();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao marcar alertas.' });
  }
});

// DELETE /api/alerts — Apagar todos os alertas (Apenas Admin)
router.delete('/alerts', requireRole('admin'), (req, res) => {
  try {
    if (db.clearAllAlerts) {
      db.clearAllAlerts();
    }
    res.json({ success: true, message: 'Todos os alertas foram excluídos.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar alertas.' });
  }
});

// GET /api/alerts/unread-count — Contagem de não lidos
router.get('/alerts/unread-count', (req, res) => {
  try {
    const count = db.getUnreadAlertCount ? db.getUnreadAlertCount() : 0;
    res.json({ count });
  } catch (err) {
    res.json({ count: 0 });
  }
});

module.exports = router;
