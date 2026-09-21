/**
 * auth.js — Rotas de Autenticação (Login e Validação de Sessão)
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../db/database');
const { authenticateJWT, JWT_SECRET, jwtUtil } = require('../middleware/auth');
const logger   = require('../logger');

const router = express.Router();

/**
 * POST /api/auth/login
 * Realiza autenticação com username e password, retornando token JWT e perfil do usuário.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Informe o usuário e a senha.' });
  }

  const user = db.getUserByUsername(username);

  if (!user) {
    logger.warn(`Tentativa de login malsucedida para usuário inexistente: ${username}`);
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);

  if (!isPasswordValid) {
    logger.warn(`Senha incorreta para usuário: ${username}`);
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  // Gera o token JWT com dados do usuário (incluindo role)
  const token = jwtUtil.sign(
    {
      id:       user.id,
      username: user.username,
      name:     user.name,
      role:     user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logger.info(`Usuário "${user.username}" (${user.role}) autenticado com sucesso.`);

  return res.json({
    token,
    user: {
      id:       user.id,
      username: user.username,
      name:     user.name,
      role:     user.role
    }
  });
});

/**
 * GET /api/auth/me
 * Retorna os dados do usuário autenticado no token.
 */
router.get('/me', authenticateJWT, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
