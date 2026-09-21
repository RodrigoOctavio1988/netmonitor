/**
 * pingService.js — Serviço de Testes de Latência (ICMP/TCP) e Monitoramento Ativo
 */
const ping   = require('ping');
const dns    = require('dns');
const os     = require('os');
const net    = require('net');
const db     = require('../db/database');
const logger = require('../logger');

const isWindows       = process.platform === 'win32';
const pingExtraParams = isWindows ? ['-n', '1'] : ['-c', '1'];

let hostnameCache            = {};
let activeMonitoringInterval = null;
let currentIntervalMs        = 5000;

/**
 * Resolve o hostname DNS reverso com cache em memória.
 */
function getHostname(ip) {
  return new Promise((resolve) => {
    if (ip === '127.0.0.1' || ip === 'localhost') {
      return resolve(os.hostname());
    }
    if (hostnameCache[ip]) {
      return resolve(hostnameCache[ip]);
    }
    dns.reverse(ip, (err, hostnames) => {
      if (err || !hostnames || hostnames.length === 0) {
        dns.lookupService(ip, 0, (errService, hostname) => {
          if (errService || !hostname) {
            resolve('Desconhecido');
          } else {
            hostnameCache[ip] = hostname;
            resolve(hostname);
          }
        });
      } else {
        const name = hostnames[0];
        hostnameCache[ip] = name;
        resolve(name);
      }
    });
  });
}

/**
 * Verifica abertura de porta TCP específica.
 */
function checkTcpPort(ip, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;
    socket.setTimeout(timeout);
    socket.on('connect', () => { status = true; socket.destroy(); });
    socket.on('timeout', () => { socket.destroy(); });
    socket.on('error',   () => { socket.destroy(); });
    socket.on('close',   () => { resolve(status); });
    socket.connect(port, ip);
  });
}

let lastDeviceStateMap = {};

/**
 * Executa o teste de conectividade (ping ou TCP) para um dispositivo.
 */
async function pingDevice(device) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  try {
    let alive = false;
    let rtt   = 0;
    const start = Date.now();

    if (device.port) {
      const portNum = parseInt(device.port, 10);
      alive = await checkTcpPort(device.ip, portNum, 2000);
      rtt   = Date.now() - start;
    } else {
      const config = { timeout: 2, extra: pingExtraParams };
      const res    = await ping.promise.probe(device.ip, config);
      alive = res.alive;
      if (res.alive) {
        rtt = res.time !== 'unknown' ? parseFloat(res.time) : 1;
      }
    }

    // Persiste no banco de dados
    db.addEntry(device.ip, {
      time: timestamp,
      rtt:  alive ? rtt : null
    });

    // ── Detecção de Mudança de Estado / Alertas ──────────────────────────────
    const prevState = lastDeviceStateMap[device.id];
    if (prevState !== undefined) {
      if (prevState.alive && !alive) {
        // Dispositivo Caiu
        db.addAlert({
          device_id: device.id,
          ip:        device.ip,
          name:      device.name,
          type:      device.critical ? 'critical' : 'warning',
          message:   `Dispositivo ${device.name} (${device.ip}) FICOU OFFLINE!`
        });
      } else if (!prevState.alive && alive) {
        // Dispositivo Restabelecido
        db.addAlert({
          device_id: device.id,
          ip:        device.ip,
          name:      device.name,
          type:      'info',
          message:   `Dispositivo ${device.name} (${device.ip}) voltou a ficar ONLINE.`
        });
      } else {
        const threshold = device.latencyThreshold || 200;
        if (alive && rtt > threshold && (!prevState.rtt || prevState.rtt <= threshold)) {
          // Latência Alta Customizável
          db.addAlert({
            device_id: device.id,
            ip:        device.ip,
            name:      device.name,
            type:      'warning',
            message:   `Alta latência em ${device.name} (${device.ip}): ${rtt.toFixed(1)} ms (limite configurado: ${threshold} ms).`
          });
        }
      }
    }
    lastDeviceStateMap[device.id] = { alive, rtt: alive ? rtt : null };

    const resolvedHostname = await getHostname(device.ip);
    const history          = db.getHistory(device.ip);
    const uptimePercent    = db.getUptime(device.ip);

    return {
      ...device,
      alive,
      rtt:           alive ? `${rtt.toFixed(1)} ms` : 'Esgotado',
      rawRtt:        alive ? rtt : null,
      hostname:      resolvedHostname,
      history,
      uptimePercent,
      lastCheckedAt: timestamp
    };
  } catch (error) {
    logger.error(`Erro ao testar ${device.ip}:`, error.message);
    return {
      ...device,
      alive:         false,
      rtt:           'Erro',
      rawRtt:        null,
      hostname:      'Erro',
      history:       db.getHistory(device.ip),
      uptimePercent: db.getUptime(device.ip),
      lastCheckedAt: timestamp
    };
  }
}

/**
 * Inicia o loop continuo de monitoramento.
 */
function startActiveMonitoring(getDevicesFn, broadcastFn) {
  if (activeMonitoringInterval) clearInterval(activeMonitoringInterval);

  const monitor = async () => {
    const devices = getDevicesFn();
    if (devices.length === 0) {
      broadcastFn({ type: 'monitoring-update', devices: [] });
      return;
    }
    const results = await Promise.all(devices.map(d => pingDevice(d)));
    broadcastFn({ type: 'monitoring-update', devices: results });
  };

  monitor();
  activeMonitoringInterval = setInterval(monitor, currentIntervalMs);
}

function stopActiveMonitoring() {
  if (activeMonitoringInterval) {
    clearInterval(activeMonitoringInterval);
    activeMonitoringInterval = null;
  }
}

function setIntervalSec(sec) {
  if (sec >= 1 && sec <= 300) {
    currentIntervalMs = sec * 1000;
    return true;
  }
  return false;
}

function getIntervalSec() {
  return currentIntervalMs / 1000;
}

module.exports = {
  getHostname,
  checkTcpPort,
  pingDevice,
  startActiveMonitoring,
  stopActiveMonitoring,
  setIntervalSec,
  getIntervalSec
};
