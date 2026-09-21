/**
 * server.js — NetMonitor Backend v3.0.0 (Modularizado)
 */
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const path       = require('path');
const WebSocket  = require('ws');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const logger     = require('./logger');
const db         = require('./db/database');
const { authenticateJWT, JWT_SECRET, jwtUtil } = require('./middleware/auth');

const authRoutes     = require('./routes/auth');
const devicesRoutes  = require('./routes/devices');
const settingsRoutes = require('./routes/settings');
const alertsRoutes   = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const { startActiveMonitoring, pingDevice, getIntervalSec } = require('./services/pingService');
const { runNetworkScan } = require('./services/scannerService');

const PORT         = process.env.PORT || 3001;

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) ? cb(null, true) : cb(new Error('Origem não permitida pelo CORS')),
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);

// Rotas públicas de autenticação
app.use('/api/auth', authRoutes);

// Proteção JWT para todas as outras rotas /api/*
app.use('/api', authenticateJWT);

app.use('/api', devicesRoutes);
app.use('/api', settingsRoutes);
app.use('/api', alertsRoutes);
app.use('/api', analyticsRoutes);

// ── Frontend estático (produção) ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
  logger.info(`Servindo frontend estático de: ${publicDir}`);
}

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}
app.locals.broadcast = broadcast;

wss.on('connection', (ws, req) => {
  // Extrai token da query string se fornecido: ws://localhost:3001?token=...
  let clientUser = { role: 'admin' };
  try {
    const urlParams = new URLSearchParams(req.url.replace(/^.*\?/, ''));
    const token = urlParams.get('token');
    if (token) {
      jwtUtil.verify(token, JWT_SECRET, (err, decoded) => {
        if (!err && decoded) clientUser = decoded;
      });
    }
  } catch (_) {}

  logger.info(`Cliente conectado via WebSocket. User: ${clientUser.username || 'Anônimo'} (${clientUser.role || 'operator'})`);
  ws.send(JSON.stringify({ type: 'settings-update', interval: getIntervalSec() }));

  const devices = db.getAllDevices();
  Promise.all(devices.map(d => pingDevice(d))).then(results => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'monitoring-update', devices: results }));
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'start-scan') {
        // Apenas usuários com perfil admin podem iniciar varredura de subrede
        if (clientUser && clientUser.role !== 'admin') {
          return ws.send(JSON.stringify({ type: 'scan-error', message: 'Acesso negado: Apenas Administradores podem executar a varredura.' }));
        }
        runNetworkScan(ws, data.startIp, data.endIp, data.cidr, !!data.scanPorts);
      }
    } catch (err) {
      logger.error('Erro no WebSocket:', err.message);
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  startActiveMonitoring(() => db.getAllDevices(), broadcast);

  // Rotina de Purge Automático de Histórico Antigo (executa a cada 24 horas)
  const RETENTION_DAYS = parseInt(process.env.HISTORY_RETENTION_DAYS || '30', 10);
  const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  
  // Limpeza inicial 10 segundos após inicialização
  setTimeout(() => {
    if (db.purgeOldRecords) {
      db.purgeOldRecords(RETENTION_DAYS);
    }
  }, 10000);

  // Agendamento periódico de 24 horas
  setInterval(() => {
    if (db.purgeOldRecords) {
      db.purgeOldRecords(RETENTION_DAYS);
    }
  }, PURGE_INTERVAL_MS);

  server.listen(PORT, () => logger.info(`NetMonitor v3.0.0 rodando na porta ${PORT}`));
}

module.exports = { app, server };
