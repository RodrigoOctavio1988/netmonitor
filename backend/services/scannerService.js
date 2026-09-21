/**
 * scannerService.js — Serviço de Varredura de Rede Ultrarrápido
 * Otimizado com alta concorrência, timeouts curtos e DNS não-bloqueante
 */
const ping   = require('ping');
const net    = require('net');
const dns    = require('dns');
const os     = require('os');
const logger = require('../logger');
const { IPv4_REGEX, ipToInt, intToIp } = require('../utils/ipUtils');

const isWindows       = process.platform === 'win32';
const pingExtraParams = isWindows ? ['-n', '1', '-w', '500'] : ['-c', '1', '-W', '1'];
const COMMON_PORTS    = [21, 22, 23, 25, 53, 80, 443, 3306, 3389, 5432, 8080, 8443];

let hostnameCache = {};

/**
 * Resolve hostname DNS reverso com timeout estrito de 300ms para não travar a varredura.
 */
function getHostname(ip) {
  if (ip === '127.0.0.1' || ip === 'localhost') return Promise.resolve(os.hostname());
  if (hostnameCache[ip]) return Promise.resolve(hostnameCache[ip]);

  return new Promise((resolve) => {
    let resolved = false;

    // Timeout de segurança de 300ms para DNS
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve('Desconhecido');
      }
    }, 300);

    dns.reverse(ip, (err, hostnames) => {
      if (resolved) return;
      if (!err && hostnames && hostnames.length > 0) {
        resolved = true;
        clearTimeout(timer);
        hostnameCache[ip] = hostnames[0];
        resolve(hostnames[0]);
      } else {
        dns.lookupService(ip, 0, (errService, hostname) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          if (!errService && hostname) {
            hostnameCache[ip] = hostname;
            resolve(hostname);
          } else {
            resolve('Desconhecido');
          }
        });
      }
    });
  });
}

/**
 * Verifica abertura de porta TCP com timeout curto de 300ms.
 */
function checkTcpPort(ip, port, timeout = 300) {
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

/**
 * Parseia CIDR (ex: "192.168.1.0/24") e retorna { startInt, endInt }.
 */
function parseCIDR(cidr) {
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return null;
  const [network, prefixStr] = parts;
  const prefix = parseInt(prefixStr, 10);
  if (!IPv4_REGEX.test(network) || isNaN(prefix) || prefix < 1 || prefix > 32) return null;
  const netInt   = ipToInt(network);
  const hostBits = 32 - prefix;
  const startInt = ((netInt >> hostBits) << hostBits) >>> 0;
  const endInt   = (startInt | ((1 << hostBits) - 1)) >>> 0;
  return {
    startInt: prefix <= 30 ? startInt + 1 : startInt,
    endInt:   prefix <= 30 ? endInt   - 1 : endInt
  };
}

/**
 * Gera lista de IPs. Aceita range manual (startIp→endIp) ou CIDR.
 */
function generateIpRange(startIp, endIp, cidr) {
  let startInt, endInt;

  if (cidr && cidr.trim()) {
    const parsed = parseCIDR(cidr);
    if (!parsed) return [];
    ({ startInt, endInt } = parsed);
  } else {
    if (!IPv4_REGEX.test(startIp) || !IPv4_REGEX.test(endIp)) return [];
    startInt = ipToInt(startIp);
    endInt   = ipToInt(endIp);
    if (startInt > endInt) return [];
  }

  const MAX_IPS = 1024;
  const ips = [];
  for (let i = startInt; i <= endInt && ips.length < MAX_IPS; i++) {
    ips.push(intToIp(i));
  }
  return ips;
}

/**
 * Executa varredura ultrarrápida de rede reportando progresso via WebSocket.
 * - Concorrência de 40 IPs simultâneos
 * - Timeout ICMP reduzido (500ms)
 * - DNS não-bloqueante
 */
async function runNetworkScan(ws, startIp, endIp, cidr, scanPorts) {
  const WebSocket  = require('ws');
  const rangeLabel = cidr ? cidr : `${startIp} → ${endIp}`;
  logger.info(`Iniciando varredura ultrarrápida: ${rangeLabel}`);

  const ips = generateIpRange(startIp, endIp, cidr);
  if (ips.length === 0) {
    ws.send(JSON.stringify({ type: 'scan-error', message: 'Faixa de IP inválida' }));
    return;
  }

  ws.send(JSON.stringify({ type: 'scan-start', total: ips.length }));

  const chunkSize    = 40; // Aumentado de 15 para 40 simultâneos
  let   scannedCount = 0;

  for (let i = 0; i < ips.length; i += chunkSize) {
    const chunk = ips.slice(i, i + chunkSize);

    const chunkResults = await Promise.all(chunk.map(async (ip) => {
      try {
        // Timeout de ping de 0.6s
        const config = { timeout: 0.6, extra: pingExtraParams };
        const res    = await ping.promise.probe(ip, config);

        let hostname  = 'Desconhecido';
        let openPorts = [];

        if (res.alive) {
          // Busca DNS e portas simultaneamente se o dispositivo estiver vivo
          const hostnamePromise = getHostname(ip);

          let portsPromise = Promise.resolve([]);
          if (scanPorts) {
            portsPromise = Promise.all(
              COMMON_PORTS.map(p => checkTcpPort(ip, p, 300).then(open => open ? p : null))
            ).then(results => results.filter(p => p !== null));
          }

          [hostname, openPorts] = await Promise.all([hostnamePromise, portsPromise]);
        }

        return {
          ip,
          alive:     res.alive,
          rtt:       res.alive
            ? (res.time !== 'unknown' ? `${parseFloat(res.time).toFixed(1)} ms` : '1 ms')
            : 'Esgotado',
          hostname,
          openPorts
        };
      } catch (_) {
        return { ip, alive: false, rtt: 'Erro', hostname: 'Erro', openPorts: [] };
      }
    }));

    const activeDevices = chunkResults.filter(r => r.alive);
    scannedCount += chunk.length;
    const progress = Math.round((scannedCount / ips.length) * 100);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type:         'scan-progress',
        progress,
        scanned:      scannedCount,
        total:        ips.length,
        foundDevices: activeDevices
      }));
    }
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'scan-complete' }));
  }
  logger.info('Varredura ultrarrápida concluída.');
}

module.exports = {
  parseCIDR,
  generateIpRange,
  runNetworkScan,
  getHostname,
  checkTcpPort,
  COMMON_PORTS
};
