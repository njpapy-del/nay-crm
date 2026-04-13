# ============================================================
# LNAYCRM — Frontend Next.js Dockerfile (standalone mode)
# ============================================================

# ─── Stage 1 : deps ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ─── Stage 2 : builder ───────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* sont inlinées au build — passer les valeurs ici
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=http://localhost:3001

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3 : runner ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl dumb-init

RUN addgroup -g 1001 -S nextjs && adduser -S nextjs -u 1001 -G nextjs

# Output standalone : bundle minimal auto-suffisant
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public           ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -sf http://localhost:3000/ -o /dev/null || exit 1

CMD ["dumb-init", "node", "server.js"]
