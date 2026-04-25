# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json tsconfig.docker.json ./
RUN npm ci

COPY src/ ./src/
RUN npx tsc --project tsconfig.docker.json

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY public/ ./public/

# Crear directorios persistentes vacíos
RUN mkdir -p database public/uploads/logos

EXPOSE 3000

CMD ["node", "dist/index.js"]
