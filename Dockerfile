# ═══════════════════════════════════════════════════════════════════════════════
# REG-X — Dockerfile unificado (frontend + backend en un solo contenedor)
#
# Stages:
#   1. deps-frontend   — instala dependencias de producción del frontend
#   2. build-frontend  — compila Vite → dist/
#   3. deps-backend    — instala dependencias del backend
#   4. build-backend   — compila TypeScript → dist/
#   5. production      — imagen final: NestJS sirve el SPA vía ServeStaticModule
#
# Uso:
#   docker build -t regx-app .
#   docker run -p 3000:3000 --env-file .env regx-app
# ═══════════════════════════════════════════════════════════════════════════════

# ── Base node ─────────────────────────────────────────────────────────────────
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache dumb-init

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1 — Frontend: instalar dependencias
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps-frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2 — Frontend: build Vite
# ─────────────────────────────────────────────────────────────────────────────
FROM deps-frontend AS build-frontend
WORKDIR /app/frontend

COPY frontend/ .

# Variables de tiempo de build (inyectadas desde CI/CD o --build-arg)
ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_ENV=production

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_APP_ENV=${VITE_APP_ENV}

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 3 — Backend: instalar dependencias
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps-backend
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --prefer-offline

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 4 — Backend: compilar TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM deps-backend AS build-backend
WORKDIR /app/backend

COPY backend/ .
RUN npm run build

# Eliminar devDependencies → imagen final más liviana
RUN npm prune --production

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 5 — Producción: imagen final unificada
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS production

# Usuario no-root
RUN addgroup -g 1001 -S regx && \
    adduser  -u 1001 -S regx -G regx

WORKDIR /app

# Copiar backend compilado
COPY --from=build-backend --chown=regx:regx /app/backend/dist       ./backend/dist
COPY --from=build-backend --chown=regx:regx /app/backend/node_modules ./backend/node_modules

# Copiar frontend compilado (NestJS lo sirve vía ServeStaticModule)
# Ruta que espera app.module.ts: join(__dirname, '..', '..', 'frontend', 'dist')
# __dirname en producción = /app/backend/dist/src
# → ruta resuelta = /app/frontend/dist
COPY --from=build-frontend --chown=regx:regx /app/frontend/dist     ./frontend/dist

# Variables de entorno por defecto (sobreescribir con --env-file .env)
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=1.0.0

USER regx
WORKDIR /app/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# dumb-init maneja señales correctamente (SIGTERM → graceful shutdown)
CMD ["dumb-init", "node", "dist/main.js"]
