# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Install all dependencies (including devDependencies for build)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install libc6-compat for Prisma native binaries on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Build Next.js production bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for the Linux/Alpine target platform.
# This creates the correct native binary (linux-musl-openssl-3.0.x).
# DATABASE_URL is not needed at build time — provide a dummy to avoid errors.
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
RUN npx prisma generate

# Build Next.js in production mode (output: standalone is set in next.config.ts)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — Minimal production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# ── Next.js standalone output ──────────────────────────────────────────────
# standalone/ contains server.js + traced node_modules (no full node_modules).
# static/ and public/ must be copied separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder                        /app/public          ./public

# ── Prisma: native binary (not traced by Next.js standalone) ──────────────
# The query engine binary must be present at runtime for DB queries.
COPY --from=builder /app/node_modules/.prisma   ./node_modules/.prisma

# ── Prisma: CLI for running migrations at container startup ───────────────
# standalone/node_modules only has runtime deps — prisma CLI is not included.
COPY --from=builder /app/node_modules/prisma    ./node_modules/prisma

# ── Prisma Engines ────────────────────────────────────────────────────────
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# ── Prisma: migration files ────────────────────────────────────────────────
COPY --from=builder /app/prisma ./prisma

# ── Entrypoint ─────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
