/**
 * logger.js — Logger estruturado com timestamps e cores (substitui winston)
 * Grava logs em console (colorido) e em arquivo ./logs/app.log
 */
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_FILE = path.join(logsDir, 'app.log');

// ANSI color codes
const COLORS = {
  error: '\x1b[31m',  // Red
  warn:  '\x1b[33m',  // Yellow
  info:  '\x1b[36m',  // Cyan
  debug: '\x1b[90m',  // Gray
  reset: '\x1b[0m'
};

const LABELS = {
  error: 'ERRO ',
  warn:  'AVISO',
  info:  'INFO ',
  debug: 'DEBUG'
};

function formatMessage(level, args) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 23);
  const parts = args.map(a =>
    a instanceof Error ? a.message : (typeof a === 'object' ? JSON.stringify(a) : String(a))
  );
  return `[${ts}] [${LABELS[level]}] ${parts.join(' ')}`;
}

function log(level, ...args) {
  const line = formatMessage(level, args);

  // Console output (colorido)
  process.stdout.write(`${COLORS[level]}${line}${COLORS.reset}\n`);

  // File output (sem cor)
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {
    // Ignora erros de escrita no log
  }
}

module.exports = {
  error: (...args) => log('error', ...args),
  warn:  (...args) => log('warn',  ...args),
  info:  (...args) => log('info',  ...args),
  debug: (...args) => log('debug', ...args)
};
