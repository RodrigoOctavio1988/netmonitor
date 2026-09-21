/**
 * auth.js — Middleware de Autenticação JWT (com suporte a crypto nativo) e RBAC
 */
const crypto = require('crypto');

let jwtModule = null;
try {
  jwtModule = require('jsonwebtoken');
} catch (_) {}

const JWT_SECRET = process.env.JWT_SECRET || 'netmonitor-super-secret-key-2026';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

const jwtUtil = {
  sign(payload, secret = JWT_SECRET, options = {}) {
    if (jwtModule) {
      try {
        return jwtModule.sign(payload, secret, options);
      } catch (_) {}
    }
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + 86400 }));
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${fullPayload}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${header}.${fullPayload}.${signature}`;
  },
  verify(token, secret = JWT_SECRET, callback) {
    if (jwtModule) {
      try {
        return jwtModule.verify(token, secret, callback);
      } catch (_) {}
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return callback(new Error('Estrutura de token inválida'));
      const [header, payload, signature] = parts;
      const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      if (signature !== expectedSig) return callback(new Error('Assinatura inválida'));
      const decoded = JSON.parse(base64UrlDecode(payload));
      if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) return callback(new Error('Token expirado'));
      callback(null, decoded);
    } catch (err) {
      callback(err);
    }
  }
};

/**
 * Middleware para Autenticação JWT
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwtUtil.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
      }
      req.user = user;
      return next();
    });
  } else {
    if (process.env.AUTH_ENABLED !== 'true') {
      req.user = { id: 'user-admin-1', username: 'admin', name: 'Administrador', role: 'admin' };
      return next();
    }
    return res.status(401).json({ error: 'Autenticação necessária. Token JWT não fornecido.' });
  }
}

/**
 * Middleware para Controle de Acesso por Perfil (RBAC)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado. Ação requer perfil [${roles.join(' ou ')}], mas o seu perfil é [${req.user.role}].`
      });
    }
    next();
  };
}

module.exports = {
  authenticateJWT,
  requireRole,
  JWT_SECRET,
  jwtUtil
};
