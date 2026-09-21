/**
 * analytics.js — Rotas REST para Analytics Avançados
 * Fase 3.2 — Gráficos e Analytics
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// Retorna timestamp de início baseado no período solicitado
function getPeriodStart(period) {
  const now = Date.now();
  const map  = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
  const ms   = map[period] || map['24h'];
  return new Date(now - ms).toISOString();
}

/**
 * GET /api/analytics/uptime?period=7d
 * Retorna uptime % de todos os dispositivos no período
 */
router.get('/analytics/uptime', (req, res) => {
  const period    = req.query.period || '24h';
  const since     = getPeriodStart(period);
  const devices   = db.getAllDevices();

  try {
    const result = devices.map(device => {
      const rows = db.getHistoryInPeriod
        ? db.getHistoryInPeriod(device.ip, since)
        : db.getHistory(device.ip);

      if (!rows || rows.length === 0) {
        return { id: device.id, name: device.name, ip: device.ip, uptimePercent: null, totalChecks: 0 };
      }

      const onlineChecks = rows.filter(r => r.rtt !== null).length;
      return {
        id:             device.id,
        name:           device.name,
        ip:             device.ip,
        uptimePercent:  ((onlineChecks / rows.length) * 100).toFixed(1),
        totalChecks:    rows.length,
        onlineChecks,
        offlineChecks:  rows.length - onlineChecks,
        category:       device.category || 'Outros',
        critical:       device.critical
      };
    });

    res.json({ period, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular uptime.' });
  }
});

/**
 * GET /api/analytics/latency-trend?device=<id>&period=24h
 * Retorna série temporal de latência para um dispositivo
 */
router.get('/analytics/latency-trend', (req, res) => {
  const { device: deviceId, period } = req.query;
  const since = getPeriodStart(period || '24h');

  try {
    if (!deviceId) {
      // Todos os dispositivos — retorna média agregada por hora
      const devices = db.getAllDevices();
      const allRows = [];

      devices.forEach(d => {
        const rows = db.getHistoryInPeriod
          ? db.getHistoryInPeriod(d.ip, since, 500)
          : db.getHistory(d.ip);
        rows.forEach(r => {
          if (r.rtt !== null) allRows.push({ time: r.time, rtt: r.rtt });
        });
      });

      // Agrupa por hora aproximada
      const byHour = {};
      allRows.forEach(r => {
        const key = r.time ? r.time.substring(0, 5) : '??:??';
        if (!byHour[key]) byHour[key] = { sum: 0, count: 0 };
        byHour[key].sum   += r.rtt;
        byHour[key].count += 1;
      });

      const trend = Object.entries(byHour)
        .map(([time, { sum, count }]) => ({ time, rtt: parseFloat((sum / count).toFixed(1)) }))
        .sort((a, b) => a.time.localeCompare(b.time));

      return res.json({ period, device: null, trend });
    }

    const device = db.getDeviceById(deviceId);
    if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });

    const rows = db.getHistoryInPeriod
      ? db.getHistoryInPeriod(device.ip, since, 500)
      : db.getHistory(device.ip);

    const trend = rows.map(r => ({
      time: r.time,
      rtt:  r.rtt !== null ? parseFloat(r.rtt.toFixed(1)) : null
    }));

    res.json({ period, device: { id: device.id, name: device.name, ip: device.ip }, trend });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar tendência de latência.' });
  }
});

/**
 * GET /api/analytics/top-worst?limit=5&period=24h
 * Retorna ranking dos dispositivos com pior latência/uptime
 */
router.get('/analytics/top-worst', (req, res) => {
  const limit   = parseInt(req.query.limit || '5', 10);
  const period  = req.query.period || '24h';
  const since   = getPeriodStart(period);
  const devices = db.getAllDevices();

  try {
    const ranked = devices.map(device => {
      const rows = db.getHistoryInPeriod
        ? db.getHistoryInPeriod(device.ip, since)
        : db.getHistory(device.ip);

      const valid = rows.filter(r => r.rtt !== null);
      const avgRtt = valid.length > 0
        ? parseFloat((valid.reduce((s, r) => s + r.rtt, 0) / valid.length).toFixed(1))
        : null;
      const maxRtt = valid.length > 0
        ? parseFloat(Math.max(...valid.map(r => r.rtt)).toFixed(1))
        : null;
      const uptimePct = rows.length > 0
        ? parseFloat(((valid.length / rows.length) * 100).toFixed(1))
        : null;

      return {
        id:           device.id,
        name:         device.name,
        ip:           device.ip,
        category:     device.category || 'Outros',
        critical:     device.critical,
        avgRtt,
        maxRtt,
        uptimePercent: uptimePct,
        totalChecks:  rows.length
      };
    });

    // Ordenar por pior uptime, depois por maior latência média
    const sorted = [...ranked]
      .filter(d => d.totalChecks > 0)
      .sort((a, b) => {
        if (a.uptimePercent !== null && b.uptimePercent !== null) {
          return a.uptimePercent - b.uptimePercent;
        }
        if (b.avgRtt !== null && a.avgRtt !== null) return b.avgRtt - a.avgRtt;
        return 0;
      })
      .slice(0, limit);

    res.json({ period, data: sorted });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar ranking.' });
  }
});

/**
 * GET /api/analytics/summary?period=24h
 * Resumo geral da rede no período
 */
router.get('/analytics/summary', (req, res) => {
  const period  = req.query.period || '24h';
  const since   = getPeriodStart(period);
  const devices = db.getAllDevices();

  try {
    let totalChecks = 0, onlineChecks = 0, sumRtt = 0, rttCount = 0;
    const alertCount = db.getUnreadAlertCount ? db.getUnreadAlertCount() : 0;

    devices.forEach(device => {
      const rows = db.getHistoryInPeriod
        ? db.getHistoryInPeriod(device.ip, since)
        : db.getHistory(device.ip);
      rows.forEach(r => {
        totalChecks++;
        if (r.rtt !== null) {
          onlineChecks++;
          sumRtt += r.rtt;
          rttCount++;
        }
      });
    });

    res.json({
      period,
      totalDevices:   devices.length,
      totalChecks,
      onlineChecks,
      offlineChecks:  totalChecks - onlineChecks,
      overallUptime:  totalChecks > 0 ? parseFloat(((onlineChecks / totalChecks) * 100).toFixed(1)) : null,
      avgRtt:         rttCount > 0 ? parseFloat((sumRtt / rttCount).toFixed(1)) : null,
      unreadAlerts:   alertCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar sumário.' });
  }
});

module.exports = router;
