#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# deploy.sh — First-time deployment of Beinsoft Accounting on VPS
# Usage: bash deploy.sh
# Run from: /opt/beinsoft/accounting/
# ══════════════════════════════════════════════════════════════════════════════
set -e

DEPLOY_DIR="/opt/beinsoft/accounting"
BACKUP_DIR="/opt/beinsoft/backups/accounting"

echo "═══════════════════════════════════════════════════"
echo "  Beinsoft Accounting — First Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "[ERROR] .env file not found at $DEPLOY_DIR/.env"
  echo "        Copy .env.example to .env and fill in values."
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "[ERROR] Docker not installed."
  exit 1
fi

# ── Create backup dir ─────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Pull latest code ──────────────────────────────────────────────────────────
echo ""
echo "[1/4] Pulling latest code..."
cd "$DEPLOY_DIR"
git pull origin main

# ── Build & start ─────────────────────────────────────────────────────────────
echo ""
echo "[2/4] Building Docker image..."
docker compose build --no-cache

echo ""
echo "[3/4] Starting services..."
docker compose up -d

# ── Wait for health ───────────────────────────────────────────────────────────
echo ""
echo "[4/4] Waiting for app to be healthy..."
RETRIES=30
COUNT=0
until docker compose ps --format json | python3 -c "import sys,json; services=json.load(sys.stdin) if isinstance(json.load(open('/dev/stdin')), list) else [json.load(open('/dev/stdin'))]; sys.exit(0)" 2>/dev/null || [ $COUNT -ge $RETRIES ]; do
  COUNT=$((COUNT + 1))
  sleep 5
done

docker compose ps

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Deploy complete!"
echo "  Application: http://demo.beinsoft.co.id"
echo "═══════════════════════════════════════════════════"
