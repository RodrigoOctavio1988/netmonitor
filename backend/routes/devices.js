/**
 * devices.js — Rotas REST para CRUD de Dispositivos e Exportação de Relatórios
 */
const express  = require('express');
const router   = express.Router();
const db       = require('../db/database');
const logger   = require('../logger');
const { IPv4_REGEX, sanitizeString } = require('../utils/ipUtils');
const { pingDevice } = require('../services/pingService');
const { requireRole } = require('../middleware/auth');

let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch (_) {}

const MAX_DEVICES = parseInt(process.env.MAX_DEVICES || '50', 10);

// GET /api/devices — Lista todos os dispositivos monitorados
router.get('/devices', (req, res) => {
  try {
    const devices = db.getAllDevices();
    res.json(devices);
  } catch (err) {
    logger.error('Erro ao buscar dispositivos:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dispositivos.' });
  }
});

// POST /api/devices — Adiciona novo dispositivo (Apenas Admin)
router.post('/devices', requireRole('admin'), (req, res) => {
  const { ip, name, critical, port, category, location, parentId, latencyThreshold } = req.body;

  if (!ip || !name) {
    return res.status(400).json({ error: 'IP e nome são obrigatórios.' });
  }

  const cleanIp       = String(ip).trim();
  const cleanName     = sanitizeString(name, 80);
  const cleanCategory = sanitizeString(category || 'Outros', 40);
  const cleanLocation = sanitizeString(location || '', 100);
  const cleanParentId = parentId ? sanitizeString(parentId, 40) : undefined;

  if (!IPv4_REGEX.test(cleanIp) && cleanIp !== 'localhost') {
    return res.status(400).json({ error: 'Endereço IPv4 inválido.' });
  }

  const currentDevices = db.getAllDevices();
  if (currentDevices.length >= MAX_DEVICES) {
    return res.status(400).json({ error: `Limite máximo de ${MAX_DEVICES} dispositivos atingido.` });
  }

  const parsedPort = port ? parseInt(port, 10) : null;
  if (port && (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
    return res.status(400).json({ error: 'Porta TCP inválida (1–65535).' });
  }

  let parsedThreshold = undefined;
  if (latencyThreshold !== undefined && latencyThreshold !== null && latencyThreshold !== '') {
    const t = parseInt(latencyThreshold, 10);
    if (isNaN(t) || t < 1 || t > 10000) {
      return res.status(400).json({ error: 'Limite de latência inválido (1–10000 ms).' });
    }
    parsedThreshold = t;
  }

  const isDuplicate = currentDevices.some(
    d => d.ip === cleanIp && (d.port === parsedPort || (!d.port && !parsedPort))
  );

  if (isDuplicate) {
    return res.status(400).json({ error: 'Este dispositivo já está sendo monitorado com esta porta/serviço.' });
  }

  const newDevice = {
    id:               Date.now().toString(),
    ip:               cleanIp,
    name:             cleanName,
    critical:         !!critical,
    port:             parsedPort || undefined,
    category:         cleanCategory || 'Outros',
    location:         cleanLocation,
    parentId:         cleanParentId,
    latencyThreshold: parsedThreshold
  };

  db.addDevice(newDevice);
  logger.info(`Dispositivo adicionado: ${cleanName} (${cleanIp}) - Categoria: ${newDevice.category}`);
  res.status(201).json(newDevice);
});

// PUT /api/devices/:id — Atualiza dispositivo existente (Apenas Admin)
router.put('/devices/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, critical, port, category, location, parentId, latencyThreshold } = req.body;

  const device = db.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  }

  const updateData = {};
  if (name     !== undefined) updateData.name     = sanitizeString(name, 80);
  if (critical !== undefined) updateData.critical = !!critical;
  if (port     !== undefined) {
    const p = port ? parseInt(port, 10) : undefined;
    if (port && (isNaN(p) || p < 1 || p > 65535)) {
      return res.status(400).json({ error: 'Porta TCP inválida.' });
    }
    updateData.port = p;
  }
  if (category !== undefined) updateData.category = sanitizeString(category || 'Outros', 40);
  if (location !== undefined) updateData.location = sanitizeString(location || '', 100);
  if (parentId !== undefined) updateData.parentId = parentId ? sanitizeString(parentId, 40) : null;

  if (latencyThreshold !== undefined) {
    if (latencyThreshold === null || latencyThreshold === '') {
      updateData.latencyThreshold = null;
    } else {
      const t = parseInt(latencyThreshold, 10);
      if (isNaN(t) || t < 1 || t > 10000) {
        return res.status(400).json({ error: 'Limite de latência inválido (1–10000 ms).' });
      }
      updateData.latencyThreshold = t;
    }
  }

  const updated = db.updateDevice(id, updateData);
  logger.info(`Dispositivo atualizado: ${updated.name} (${updated.ip})`);
  res.json(updated);
});

// DELETE /api/devices/:id — Remove dispositivo (Apenas Admin)
router.delete('/devices/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const success = db.deleteDevice(id);
  if (!success) {
    return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  }
  logger.info(`Dispositivo removido: ID ${id}`);
  res.json({ message: 'Dispositivo removido com sucesso.' });
});

// POST /api/devices/:id/ping — Dispara ping manual instantâneo para um dispositivo
router.post('/devices/:id/ping', async (req, res) => {
  const { id } = req.params;
  const device = db.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  }

  try {
    const result = await pingDevice(device);
    res.json(result);
  } catch (error) {
    logger.error(`Erro ao executar ping manual em ${device.ip}:`, error.message);
    res.status(500).json({ error: 'Erro ao executar teste de conexão.' });
  }
});

// GET /api/devices/:id/stats — Traz métricas detalhadas e histórico para analytics
router.get('/devices/:id/stats', (req, res) => {
  const { id } = req.params;
  const device = db.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  }

  const stats = db.getDeviceStats ? db.getDeviceStats(device.ip) : null;
  res.json({
    device,
    stats: stats || { totalChecks: 0, onlineChecks: 0, offlineChecks: 0, uptimePercent: null, avgRtt: null, history: [] }
  });
});

// GET /api/export — Exporta relatórios CSV, JSON e PDF
router.get('/export', async (req, res) => {
  const format  = (req.query.format || 'csv').toLowerCase();
  const devices = db.getAllDevices();

  try {
    const results = await Promise.all(devices.map(d => pingDevice(d)));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio_rede.json');
      return res.json({
        generatedAt:  new Date().toISOString(),
        totalDevices: results.length,
        online:       results.filter(d => d.alive).length,
        offline:      results.filter(d => !d.alive).length,
        devices: results.map(d => ({
          id:       d.id,
          name:     d.name,
          ip:       d.ip,
          port:     d.port || null,
          protocol: d.port ? `TCP:${d.port}` : 'ICMP Ping',
          status:   d.alive ? 'Online' : 'Offline',
          latency:  d.rawRtt !== null ? `${d.rawRtt.toFixed(1)} ms` : 'N/A',
          hostname: d.hostname || 'Desconhecido',
          critical: d.critical,
          uptime:   d.uptimePercent ? `${d.uptimePercent}%` : 'N/A',
          history:  d.history || []
        }))
      });
    }

    if (format === 'pdf') {
      if (!PDFDocument) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_rede.txt');
        let txt = `RELATÓRIO DE MONITORAMENTO DE REDE\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
        txt += `Total: ${results.length} | Online: ${results.filter(d => d.alive).length} | Offline: ${results.filter(d => !d.alive).length}\n\n`;
        results.forEach(d => {
          txt += `[${d.alive ? 'ONLINE' : 'OFFLINE'}] ${d.name} (${d.ip}) - Latência: ${d.rawRtt !== null ? d.rawRtt.toFixed(1) + ' ms' : 'N/A'} | Uptime: ${d.uptimePercent ? d.uptimePercent + '%' : 'N/A'}\n`;
        });
        return res.send(txt);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio_rede.pdf');

      const doc    = new PDFDocument({ margin: 50, size: 'A4' });
      const online = results.filter(d => d.alive).length;
      doc.pipe(res);

      doc.fontSize(22).font('Helvetica-Bold').fillColor('#1d4ed8').text('NetMonitor', { align: 'center' });
      doc.fontSize(11).font('Helvetica').fillColor('#64748b').text('Relatório de Monitoramento de Rede', { align: 'center' });
      doc.fontSize(9).fillColor('#94a3b8').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Resumo:');
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text(`  Total de dispositivos : ${results.length}`);
      doc.text(`  Online                : ${online}`);
      doc.text(`  Offline               : ${results.length - online}`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Dispositivos Monitorados:');
      doc.moveDown(0.5);

      results.forEach((d) => {
        if (doc.y > 690) doc.addPage();
        const statusColor = d.alive ? '#16a34a' : '#dc2626';
        const statusLabel = d.alive ? '● ONLINE' : '● OFFLINE';

        doc.font('Helvetica-Bold').fontSize(10).fillColor(statusColor).text(`${statusLabel}  `, { continued: true });
        doc.fillColor('#0f172a').text(d.name);
        doc.font('Helvetica').fontSize(8.5).fillColor('#475569');
        doc.text(`    IP: ${d.ip}${d.port ? `  |  Porta: ${d.port}` : ''}  |  Tipo: ${d.port ? `TCP:${d.port}` : 'ICMP Ping'}`);
        doc.text(`    Latência: ${d.rawRtt !== null ? `${d.rawRtt.toFixed(1)} ms` : 'N/A'}  |  Uptime: ${d.uptimePercent ? `${d.uptimePercent}%` : 'N/A'}  |  Crítico: ${d.critical ? 'Sim' : 'Não'}`);
        doc.text(`    Hostname: ${d.hostname || 'Desconhecido'}`);
        doc.moveDown(0.6);
      });

      doc.end();
      return;
    }

    // CSV (padrão)
    const csvHeader = 'Nome,IP,Porta,Tipo,Status,Latência (ms),Hostname,Crítico,Uptime\n';
    const csvRows   = results.map(d => {
      const tipo     = d.port ? `TCP:${d.port}` : 'ICMP Ping';
      const status   = d.alive ? 'Online' : 'Offline';
      const latencia = d.rawRtt !== null ? d.rawRtt.toFixed(1) : 'N/A';
      const critico  = d.critical ? 'Sim' : 'Não';
      const uptime   = d.uptimePercent ? `${d.uptimePercent}%` : 'N/A';
      const hostname = (d.hostname || 'Desconhecido').replace(/,/g, ';');
      const nome     = (d.name    || '').replace(/,/g, ';');
      return `${nome},${d.ip},${d.port || 'N/A'},${tipo},${status},${latencia},${hostname},${critico},${uptime}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_rede.csv');
    res.send('\uFEFF' + csvHeader + csvRows);

  } catch (error) {
    logger.error('Erro ao gerar relatório:', error.message);
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});

module.exports = router;
