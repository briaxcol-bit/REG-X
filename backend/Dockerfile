# ============================================================
# REG-X Backend — Dockerfile (Windows compatible)
# ============================================================

# ── Stage 1: Dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile

# ── Stage 2: Development ─────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "start:debug"]

# ── Stage 3: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Prune dev deps
RUN npm prune --production

# ── Stage 4: Production ───────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Non-root user for security
RUN addgroup -g 1001 -S regx && adduser -S -u 1001 regx
USER regx

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
