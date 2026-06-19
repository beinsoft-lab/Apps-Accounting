# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Install all dependencies (including devDependencies for build)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# libc6-compat: glibc shim required by some native addons on musl/Alpine
# openssl: required by Prisma to detect the correct engine binary variant
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Build Next.js production bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

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

# libc6-compat: required by Prisma native engine binaries on Alpine/musl
# openssl: Prisma CLI runs `openssl version` at startup to select the correct
#          engine binary (linux-musl-openssl-3.0.x). Without it, detection
#          fails and Prisma attempts to re-download the binary — which then
#          fails because the target directory is owned by root.
RUN apk add --no-cache libc6-compat openssl

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
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# ── Prisma: generated client with native query engine binary ───────────────
# Not traced by Next.js standalone — must be copied explicitly.
# chown is mandatory: nextjs user must be able to read (and in some Prisma
# versions, lock) files inside this directory at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma   ./node_modules/.prisma

# ── Prisma: CLI for running migrations at container startup ───────────────
# The standalone trace excludes devDependencies such as the prisma CLI.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma    ./node_modules/prisma

# ── Prisma: engines package (query engine + migration engine binaries) ────
# Prisma CLI resolves and executes engine binaries from this directory.
# Must be owned by nextjs; if the detected binary is missing, Prisma will
# attempt to write a downloaded binary here — which fails under root ownership.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma   ./node_modules/@prisma

# ── Prisma: migration files and schema ────────────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# ── Entrypoint ─────────────────────────────────────────────────────────────
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
