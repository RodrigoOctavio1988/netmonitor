/**
 * ipUtils.js — Utilitários de IP, Notação de Rede e Sanitização
 */
const os = require('os');

// Regex de validação IPv4
const IPv4_REGEX = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Converte string IPv4 em número inteiro de 32 bits sem sinal.
 * @param {string} ip 
 * @returns {number}
 */
function ipToInt(ip) {
  if (!IPv4_REGEX.test(ip)) return 0;
  return ip.split('.').reduce((acc, oct) => ((acc << 8) + parseInt(oct, 10)) >>> 0, 0);
}

/**
 * Converte número inteiro de 32 bits em string IPv4.
 * @param {number} int 
 * @returns {string}
 */
function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8)  & 255,
     int         & 255
  ].join('.');
}

/**
 * Detecção da faixa de rede local baseada nas interfaces do SO.
 * @returns {{localIp: string, startIp: string, endIp: string}}
 */
function detectLocalNetworkRange() {
  const interfaces = os.networkInterfaces();
  let localIp = '192.168.1.100';
  let found = false;
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.')       ||
          iface.address.startsWith('172.')
        ) {
          localIp = iface.address;
          found = true;
          break;
        }
      }
    }
    if (found) break;
  }
  const parts = localIp.split('.');
  if (parts.length === 4) {
    const base = `${parts[0]}.${parts[1]}.${parts[2]}.`;
    return { localIp, startIp: `${base}1`, endIp: `${base}25` };
  }
  return { localIp: '127.0.0.1', startIp: '192.168.1.1', endIp: '192.168.1.25' };
}

/**
 * Sanitiza entrada de string para evitar injeções XSS/HTML
 * @param {string} str 
 * @param {number} maxLength 
 * @returns {string}
 */
function sanitizeString(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '').trim().substring(0, maxLength);
}

module.exports = {
  IPv4_REGEX,
  ipToInt,
  intToIp,
  detectLocalNetworkRange,
  sanitizeString
};
