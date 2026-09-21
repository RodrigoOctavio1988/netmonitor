# ============================================================
# NetMonitor — Dockerfile Multi-Stage
# Stage 1: deps         → Instala dependências (com build tools)
# Stage 2: frontend-build → Build do Vite (assets estáticos)
# Stage 3: production   → Imagem final limpa (Node.js runtime)
# ============================================================

# ── Stage 1: Dependências ─────────────────────────────────────
FROM node:20-slim AS deps

# Ferramentas de build necessárias para compilar better-sqlite3 (módulo nativo C++)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Root package files (monorepo)
COPY package.json package-lock.json ./

# Backend package files
COPY backend/package.json backend/package-lock.json* ./backend/

# Frontend package files
COPY frontend/package.json frontend/package-lock.json* ./frontend/

# Instala dependências do root (concurrently etc.)
RUN npm ci --ignore-scripts

# Instala dependências do backend (inclui compilação do better-sqlite3)
WORKDIR /app/backend
RUN npm install

# Instala dependências do frontend
WORKDIR /app/frontend
RUN npm ci

# ── Stage 2: Build do Frontend (Vite) ────────────────────────
FROM deps AS frontend-build

WORKDIR /app/frontend

# Copia todo o código-fonte do frontend
COPY frontend/ ./

# Variáveis de build — URLs vazias para usar caminhos relativos
# (frontend e backend serão servidos na mesma porta em produção)
ENV VITE_WS_URL=""
ENV VITE_API_URL=""

# Executa o build do Vite → gera assets em /app/frontend/dist
RUN npm run build

# ── Stage 3: Produção ────────────────────────────────────────
FROM node:20-slim AS production

# Metadados da imagem
LABEL maintainer="NetMonitor Team"
LABEL description="NetMonitor - Monitoramento de Rede e Ping Tester"
LABEL version="3.0.0"

# Dependências de runtime para better-sqlite3 (apenas libs, sem compilador)
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Cria usuário não-root para segurança
RUN groupadd -r netmonitor && useradd -r -g netmonitor -m netmonitor

WORKDIR /app

# Copia o backend com suas dependências já compiladas
COPY --from=deps /app/backend/ ./backend/
COPY backend/ ./backend/

# Copia os assets estáticos do frontend buildado para backend/public
COPY --from=frontend-build /app/frontend/dist/ ./backend/public/

# Cria diretório para persistência do banco de dados SQLite
RUN mkdir -p /app/data && chown -R netmonitor:netmonitor /app

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/netmonitor.db
ENV CORS_ORIGIN=*
ENV AUTH_ENABLED=false
ENV RATE_LIMIT_WINDOW_MS=900000
ENV RATE_LIMIT_MAX=300
ENV MAX_DEVICES=50
ENV HISTORY_SIZE=100

# Muda para usuário não-root
USER netmonitor

# Expõe a porta da aplicação
EXPOSE 3001

# Volume para persistência do banco de dados
VOLUME ["/app/data"]

# Health check — verifica se a API responde
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:3001/api/devices', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.setTimeout(5000, () => { req.destroy(); process.exit(1); });"

# Inicia o servidor
WORKDIR /app/backend
CMD ["node", "server.js"]
