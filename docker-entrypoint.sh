#!/bin/sh
set -e

echo "[entrypoint] DATABASE_URL target: $(echo "$DATABASE_URL" | sed 's|//.*@|//***:***@|')"

# Verify the Prisma migration engine binary is accessible before attempting
# migrations. An unreadable or missing binary produces a cryptic error — this
# surfacees the real cause immediately.
PRISMA_CLI="/app/node_modules/prisma/build/index.js"
if [ ! -f "$PRISMA_CLI" ]; then
  echo "[entrypoint] FATAL: Prisma CLI not found at $PRISMA_CLI"
  echo "[entrypoint] Ensure node_modules/prisma is copied with --chown=nextjs:nodejs in the Dockerfile."
  exit 1
fi

# ─── Run Prisma migrations ────────────────────────────────────────────────────
# Retries are a safety net; docker-compose depends_on: service_healthy
# already ensures MySQL is accepting connections before this container starts.
MAX_RETRIES=10
COUNT=0

echo "[entrypoint] Running database migrations..."
until node "$PRISMA_CLI" migrate deploy; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ERROR: Migration failed after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "[entrypoint] Migration attempt $COUNT/$MAX_RETRIES failed. Retrying in 5s..."
  sleep 5
done

echo "[entrypoint] Migrations complete."

# ─── Start Next.js ────────────────────────────────────────────────────────────
echo "[entrypoint] Starting Next.js server..."
exec node /app/server.js
