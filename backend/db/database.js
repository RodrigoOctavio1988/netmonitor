/**
 * database.js — Gerenciador de Persistência (SQLite com Fallback JSON)
 * Se better-sqlite3 estiver disponível, utiliza SQLite relacional.
 * Caso contrário, utiliza fallback em arquivo JSON de forma transparente.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const logger = require('../logger');

const DB_PATH          = process.env.DB_PATH || path.join(__dirname, 'netmonitor.db');
const DEVICES_FILE     = path.join(__dirname, '..', 'monitored_devices.json');
const LATENCY_FILE     = path.join(__dirname, '..', 'latency_history.json');
const HISTORY_SIZE     = parseInt(process.env.HISTORY_SIZE || '100', 10);

let db = null;
let useSqlite = false;

// Tenta carregar better-sqlite3
try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  useSqlite = true;
  logger.info(`Conectado ao banco de dados SQLite: ${DB_PATH}`);
} catch (err) {
  logger.warn(`better-sqlite3 não disponível (${err.message}). Utilizando persistência em arquivos JSON.`);
  useSqlite = false;
}

// ── Modos de Operação ────────────────────────────────────────────────────────

if (useSqlite) {
  // Inicialização do Esquema SQLite
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      name TEXT NOT NULL,
      critical INTEGER DEFAULT 0,
      port INTEGER,
      category TEXT DEFAULT 'Outros',
      location TEXT DEFAULT '',
      parentId TEXT,
      latency_threshold INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS latency_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      rtt REAL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_latency_ip ON latency_history(ip);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator'
    );

    CREATE TABLE IF NOT EXISTS alerts_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT,
      ip TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      read INTEGER DEFAULT 0
    );
  `);

  // Migrações automáticas para bancos já existentes
  try {
    db.exec('ALTER TABLE devices ADD COLUMN latency_threshold INTEGER DEFAULT NULL');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE latency_history ADD COLUMN created_at TEXT DEFAULT NULL');
  } catch (_) {}

  // Semeadura de Usuários Padrão (Admin & Operador)
  const bcrypt = require('bcryptjs');
  const usersCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (usersCount === 0) {
    const adminHash    = bcrypt.hashSync('admin123', 10);
    const operatorHash = bcrypt.hashSync('operador123', 10);
    const stmt = db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)');
    stmt.run('user-admin-1', 'admin', adminHash, 'Administrador do Sistema', 'admin');
    stmt.run('user-operator-1', 'operador', operatorHash, 'Operador de Rede', 'operator');
    logger.info('Usuários padrão inicializados: admin e operador.');
  }

  // Migração legada
  const devicesCount = db.prepare('SELECT COUNT(*) AS count FROM devices').get().count;
  if (devicesCount === 0 && fs.existsSync(DEVICES_FILE)) {
    try {
      const raw = fs.readFileSync(DEVICES_FILE, 'utf8');
      const legacyDevices = JSON.parse(raw);
      if (Array.isArray(legacyDevices) && legacyDevices.length > 0) {
        const stmt = db.prepare(`
          INSERT INTO devices (id, ip, name, critical, port, category, location, parentId, latency_threshold)
          VALUES (@id, @ip, @name, @critical, @port, @category, @location, @parentId, @latency_threshold)
        `);
        const insertMany = db.transaction((list) => {
          for (const d of list) {
            stmt.run({
              id:                d.id || Date.now().toString(),
              ip:                d.ip,
              name:              d.name,
              critical:          d.critical ? 1 : 0,
              port:              d.port || null,
              category:          d.category || 'Outros',
              location:          d.location || '',
              parentId:          d.parentId || null,
              latency_threshold: d.latencyThreshold || null
            });
          }
        });
        insertMany(legacyDevices);
        logger.info(`Migrados ${legacyDevices.length} dispositivos para o SQLite.`);
      }
    } catch (_) {}
  }
}

// ── Fallback JSON ───────────────────────────────────────────────────────────

function loadJsonDevices() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function saveJsonDevices(list) {
  try {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (_) {}
}

function loadJsonHistory() {
  try {
    if (fs.existsSync(LATENCY_FILE)) {
      return JSON.parse(fs.readFileSync(LATENCY_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveJsonHistory(map) {
  try {
    fs.writeFileSync(LATENCY_FILE, JSON.stringify(map, null, 2), 'utf8');
  } catch (_) {}
}

// ── Interface Exportada ──────────────────────────────────────────────────────

module.exports = {
  getAllDevices() {
    if (useSqlite) {
      const rows = db.prepare('SELECT * FROM devices').all();
      return rows.map(r => ({
        ...r,
        critical:         Boolean(r.critical),
        port:             r.port || undefined,
        parentId:         r.parentId || undefined,
        latencyThreshold: (r.latency_threshold !== null && r.latency_threshold !== undefined) ? Number(r.latency_threshold) : undefined
      }));
    }
    return loadJsonDevices();
  },

  getDeviceById(id) {
    if (useSqlite) {
      const r = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!r) return null;
      return {
        ...r,
        critical:         Boolean(r.critical),
        port:             r.port || undefined,
        parentId:         r.parentId || undefined,
        latencyThreshold: (r.latency_threshold !== null && r.latency_threshold !== undefined) ? Number(r.latency_threshold) : undefined
      };
    }
    return loadJsonDevices().find(d => d.id === id) || null;
  },

  addDevice(device) {
    if (useSqlite) {
      const stmt = db.prepare(`
        INSERT INTO devices (id, ip, name, critical, port, category, location, parentId, latency_threshold)
        VALUES (@id, @ip, @name, @critical, @port, @category, @location, @parentId, @latency_threshold)
      `);
      stmt.run({
        id:                device.id,
        ip:                device.ip,
        name:              device.name,
        critical:          device.critical ? 1 : 0,
        port:              device.port || null,
        category:          device.category || 'Outros',
        location:          device.location || '',
        parentId:          device.parentId || null,
        latency_threshold: device.latencyThreshold || null
      });
    } else {
      const list = loadJsonDevices();
      list.push(device);
      saveJsonDevices(list);
    }
    return device;
  },

  updateDevice(id, data) {
    if (useSqlite) {
      const current = this.getDeviceById(id);
      if (!current) return null;
      const updated = { ...current, ...data };
      const stmt = db.prepare(`
        UPDATE devices
        SET name = @name, critical = @critical, port = @port, category = @category, location = @location, parentId = @parentId, latency_threshold = @latency_threshold
        WHERE id = @id
      `);
      stmt.run({
        id,
        name:              updated.name,
        critical:          updated.critical ? 1 : 0,
        port:              updated.port || null,
        category:          updated.category || 'Outros',
        location:          updated.location || '',
        parentId:          updated.parentId || null,
        latency_threshold: updated.latencyThreshold !== undefined ? (updated.latencyThreshold || null) : (current.latencyThreshold || null)
      });
      return updated;
    } else {
      const list = loadJsonDevices();
      const idx  = list.findIndex(d => d.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...data };
      saveJsonDevices(list);
      return list[idx];
    }
  },

  deleteDevice(id) {
    if (useSqlite) {
      const device = this.getDeviceById(id);
      if (!device) return false;
      db.prepare('DELETE FROM devices WHERE id = ?').run(id);
      this.clearHistory(device.ip);
      return true;
    } else {
      let list = loadJsonDevices();
      const removed = list.find(d => d.id === id);
      if (!removed) return false;
      list = list.filter(d => d.id !== id);
      saveJsonDevices(list);
      this.clearHistory(removed.ip);
      return true;
    }
  },

  // --- Histórico ---
  getHistory(ip) {
    if (useSqlite) {
      const rows = db.prepare(`
        SELECT timestamp AS time, rtt
        FROM latency_history
        WHERE ip = ?
        ORDER BY id DESC
        LIMIT ?
      `).all(ip, HISTORY_SIZE);
      return rows.reverse();
    } else {
      const historyMap = loadJsonHistory();
      return (historyMap[ip] || []).slice(-HISTORY_SIZE);
    }
  },

  // Retorna histórico filtrado por período (ISO timestamp de início)
  getHistoryInPeriod(ip, since, limit = 1000) {
    if (useSqlite) {
      const rows = db.prepare(`
        SELECT timestamp AS time, rtt
        FROM latency_history
        WHERE ip = ? AND timestamp >= ?
        ORDER BY id ASC
        LIMIT ?
      `).all(ip, since, limit);
      return rows;
    } else {
      const historyMap = loadJsonHistory();
      return (historyMap[ip] || []).slice(-limit);
    }
  },

  addEntry(ip, entry) {
    if (useSqlite) {
      const stmt = db.prepare(`
        INSERT INTO latency_history (ip, timestamp, rtt, created_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
      `);
      stmt.run(ip, entry.time || new Date().toISOString(), entry.rtt !== undefined ? entry.rtt : null);
      db.prepare(`
        DELETE FROM latency_history
        WHERE ip = ? AND id NOT IN (
          SELECT id FROM latency_history WHERE ip = ? ORDER BY id DESC LIMIT ?
        )
      `).run(ip, ip, HISTORY_SIZE + 50);
    } else {
      const historyMap = loadJsonHistory();
      if (!historyMap[ip]) historyMap[ip] = [];
      historyMap[ip].push(entry);
      if (historyMap[ip].length > HISTORY_SIZE) {
        historyMap[ip] = historyMap[ip].slice(-HISTORY_SIZE);
      }
      saveJsonHistory(historyMap);
    }
  },

  clearHistory(ip) {
    if (useSqlite) {
      db.prepare('DELETE FROM latency_history WHERE ip = ?').run(ip);
    } else {
      const historyMap = loadJsonHistory();
      delete historyMap[ip];
      saveJsonHistory(historyMap);
    }
  },

  getUptime(ip) {
    const history = this.getHistory(ip);
    if (!history || history.length === 0) return null;
    const online = history.filter(h => h.rtt !== null).length;
    return ((online / history.length) * 100).toFixed(1);
  },

  // ── Alertas ──────────────────────────────────────────────────────────────
  addAlert(alert) {
    if (useSqlite) {
      db.prepare(`
        INSERT INTO alerts_log (device_id, ip, name, type, message, timestamp, read)
        VALUES (@device_id, @ip, @name, @type, @message, @timestamp, 0)
      `).run({
        device_id: alert.device_id || null,
        ip:        alert.ip,
        name:      alert.name || 'Desconhecido',
        type:      alert.type || 'warning',
        message:   alert.message,
        timestamp: alert.timestamp || new Date().toISOString()
      });
    }
  },

  getAlerts(limit = 100) {
    if (useSqlite) {
      return db.prepare('SELECT * FROM alerts_log ORDER BY id DESC LIMIT ?').all(limit);
    }
    return [];
  },

  markAlertRead(id) {
    if (useSqlite) {
      db.prepare('UPDATE alerts_log SET read = 1 WHERE id = ?').run(id);
    }
  },

  markAllAlertsRead() {
    if (useSqlite) {
      db.prepare('UPDATE alerts_log SET read = 1 WHERE read = 0').run();
    }
  },

  clearAllAlerts() {
    if (useSqlite) {
      db.prepare('DELETE FROM alerts_log').run();
    }
  },

  getUnreadAlertCount() {
    if (useSqlite) {
      const row = db.prepare('SELECT COUNT(*) AS count FROM alerts_log WHERE read = 0').get();
      return row ? row.count : 0;
    }
    return 0;
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  getDeviceStats(ip) {
    if (useSqlite) {
      const rows = db.prepare(`
        SELECT timestamp AS time, rtt
        FROM latency_history
        WHERE ip = ?
        ORDER BY id DESC
        LIMIT 500
      `).all(ip);

      if (rows.length === 0) return null;

      const valid = rows.filter(r => r.rtt !== null);
      const avgRtt = valid.length > 0
        ? valid.reduce((s, r) => s + r.rtt, 0) / valid.length
        : null;
      const maxRtt = valid.length > 0 ? Math.max(...valid.map(r => r.rtt)) : null;
      const minRtt = valid.length > 0 ? Math.min(...valid.map(r => r.rtt)) : null;

      return {
        totalChecks: rows.length,
        onlineChecks: valid.length,
        offlineChecks: rows.length - valid.length,
        uptimePercent: ((valid.length / rows.length) * 100).toFixed(1),
        avgRtt: avgRtt !== null ? avgRtt.toFixed(1) : null,
        maxRtt: maxRtt !== null ? maxRtt.toFixed(1) : null,
        minRtt: minRtt !== null ? minRtt.toFixed(1) : null,
        history: rows.reverse()
      };
    }
    return null;
  },

  // ── Usuários & Autenticação ────────────────────────────────────────────────
  getUserByUsername(username) {
    if (useSqlite) {
      return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
    }
    // Fallback em memória para testes sem SQLite
    const bcrypt = require('bcryptjs');
    if (username === 'admin') {
      return { id: 'user-admin-1', username: 'admin', password: bcrypt.hashSync('admin123', 10), name: 'Administrador do Sistema', role: 'admin' };
    }
    if (username === 'operador') {
      return { id: 'user-operator-1', username: 'operador', password: bcrypt.hashSync('operador123', 10), name: 'Operador de Rede', role: 'operator' };
    }
    return null;
  },

  getUserById(id) {
    if (useSqlite) {
      return db.prepare('SELECT id, username, name, role FROM users WHERE id = ?').get(id) || null;
    }
    if (id === 'user-admin-1') return { id: 'user-admin-1', username: 'admin', name: 'Administrador do Sistema', role: 'admin' };
    if (id === 'user-operator-1') return { id: 'user-operator-1', username: 'operador', name: 'Operador de Rede', role: 'operator' };
    return null;
  },

  // ── Limpeza e Otimização do SQLite (Purge) ──────────────────────────────────
  purgeOldRecords(days = 30) {
    if (useSqlite) {
      try {
        const retentionDays = parseInt(days, 10) || 30;
        
        // 1. Purgar histórico antigo (por created_at ou trim por volume)
        const histStmt = db.prepare(`
          DELETE FROM latency_history
          WHERE (created_at IS NOT NULL AND created_at < datetime('now', '-' || ? || ' days', 'localtime'))
        `);
        const histResult = histStmt.run(retentionDays);

        // 2. Garante que nenhum IP ultrapasse HISTORY_SIZE no banco
        const trimStmt = db.prepare(`
          DELETE FROM latency_history
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY ip ORDER BY id DESC) as rn
              FROM latency_history
            ) WHERE rn <= ?
          )
        `);
        const trimResult = trimStmt.run(HISTORY_SIZE);

        // 3. Purgar alertas lidos antigos
        const alertStmt = db.prepare(`
          DELETE FROM alerts_log
          WHERE read = 1 AND timestamp < datetime('now', '-' || ? || ' days', 'localtime')
        `);
        const alertResult = alertStmt.run(retentionDays);

        // 4. Executa VACUUM para recuperar fisicamente o espaço em disco no Windows
        db.exec('VACUUM');

        const deletedHistory = (histResult.changes || 0) + (trimResult.changes || 0);
        const deletedAlerts  = alertResult.changes || 0;

        logger.info(`Limpeza automática SQLite: ${deletedHistory} registros de histórico e ${deletedAlerts} alertas antigos removidos. VACUUM executado.`);
        return {
          success: true,
          deletedHistory,
          deletedAlerts,
          ...this.getDbStats()
        };
      } catch (err) {
        logger.error('Erro ao executar purge no SQLite:', err.message);
        return { success: false, error: err.message };
      }
    } else {
      return { success: true, message: 'Modo JSON ativo - registros limitados em memória.', ...this.getDbStats() };
    }
  },

  getDbStats() {
    let sizeMb = '0.00';
    let totalHistory = 0;
    let totalAlerts = 0;
    let totalDevices = 0;

    if (useSqlite) {
      try {
        if (fs.existsSync(DB_PATH)) {
          const stats = fs.statSync(DB_PATH);
          sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
        }
        totalHistory = db.prepare('SELECT COUNT(*) AS count FROM latency_history').get().count;
        totalAlerts  = db.prepare('SELECT COUNT(*) AS count FROM alerts_log').get().count;
        totalDevices = db.prepare('SELECT COUNT(*) AS count FROM devices').get().count;
      } catch (_) {}
    }
    return {
      dbType: useSqlite ? 'SQLite' : 'JSON',
      sizeMb: `${sizeMb} MB`,
      totalHistory,
      totalAlerts,
      totalDevices
    };
  }
};

