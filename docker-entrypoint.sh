#!/bin/sh
set -e

echo "[entrypoint] DATABASE_URL target: $(echo "$DATABASE_URL" | sed 's|//.*@|//***:***@|')"

# ─── Run Prisma migrations ────────────────────────────────────────────────────
# Retries are a safety net; docker-compose depends_on: service_healthy
# already ensures MySQL is accepting connections before this container starts.
MAX_RETRIES=10
COUNT=0

echo "[entrypoint] Running database migrations..."
until node /app/node_modules/prisma/build/index.js migrate deploy; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ERROR: Migration failed after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "[entrypoint] Migration attempt $COUNT failed. Retrying in 5s..."
  sleep 5
done

echo "[entrypoint] Migrations complete."

# ─── Start Next.js ────────────────────────────────────────────────────────────
echo "[entrypoint] Starting Next.js server..."
exec node /app/server.js
