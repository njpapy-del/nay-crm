# ============================================================
# LNAYCRM — Backend NestJS Dockerfile (multi-stage)
# ============================================================

# ─── Stage 1 : deps ──────────────────────────────────────────
# Installe TOUTES les dépendances (dev + prod) pour le build
FROM node:20-alpine AS deps
WORKDIR /app

# Outils système nécessaires à certains packages natifs (bcrypt, canvas…)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --frozen-lockfile

# ─── Stage 2 : builder ───────────────────────────────────────
# Génère le client Prisma + compile TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génère le client Prisma AVANT le build NestJS
RUN npx prisma generate

# Compile (nest build → dist/src/main.js via tsconfig baseUrl="./" + outDir="./dist")
RUN npm run build

# ─── Stage 3 : runner ────────────────────────────────────────
# Image finale allégée : uniquement les dépendances de production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Outils système runtime
RUN apk add --no-cache curl dumb-init

# Dépendances production seulement
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --frozen-lockfile --omit=dev && npm cache clean --force

# Artefacts du builder
COPY --from=builder /app/dist              ./dist
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma

# Répertoire d'enregistrements Asterisk (volume monté en prod)
RUN mkdir -p /var/spool/asterisk/monitor

# Utilisateur non-root
RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001 -G nestjs
RUN chown -R nestjs:nestjs /app /var/spool/asterisk
USER nestjs

EXPOSE 3001

# Healthcheck : vérifie que le process répond en HTTP
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -sf -o /dev/null \
       -w "%{http_code}" \
       -X POST http://localhost:3001/api/v1/auth/login \
       -H "Content-Type: application/json" \
       -d '{}' \
    | grep -qE "^(400|401|200)" || exit 1

# dumb-init évite les problèmes de signal/zombie avec Node
CMD ["dumb-init", "node", "dist/src/main.js"]
