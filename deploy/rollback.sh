#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# rollback.sh — Rollback app to previous Docker image
# Usage: bash rollback.sh [IMAGE_ID]
#        bash rollback.sh                  → rollback to previous tag
#        bash rollback.sh abc123def456     → rollback to specific image ID
# Run from: /opt/beinsoft/accounting/
# ══════════════════════════════════════════════════════════════════════════════
set -e

DEPLOY_DIR="/opt/beinsoft/accounting"
BACKUP_DIR="/opt/beinsoft/backups/accounting"
TARGET_IMAGE="${1:-}"

echo "═══════════════════════════════════════════════════"
echo "  Beinsoft Accounting — Rollback"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"

cd "$DEPLOY_DIR"

# ── List available images ─────────────────────────────────────────────────────
echo ""
echo "Available beinsoft-accounting images:"
docker images beinsoft-accounting --format "table {{.ID}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"

if [ -z "$TARGET_IMAGE" ]; then
  echo ""
  echo "[ERROR] Provide image ID as argument."
  echo "        Usage: bash deploy/rollback.sh <IMAGE_ID>"
  exit 1
fi

# ── Tag target image as latest ────────────────────────────────────────────────
echo ""
echo "[1/3] Tagging image $TARGET_IMAGE as latest..."
docker tag "$TARGET_IMAGE" beinsoft-accounting:latest

# ── Restart app with previous image ──────────────────────────────────────────
echo ""
echo "[2/3] Restarting app with previous image..."
docker compose up -d --no-deps --no-build app

# ── Verify health ─────────────────────────────────────────────────────────────
echo ""
echo "[3/3] Verifying app health..."
RETRIES=24
COUNT=0
until docker inspect --format='{{.State.Health.Status}}' beinsoft_accounting_app 2>/dev/null | grep -q "healthy"; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$RETRIES" ]; then
    echo "[ERROR] Rollback failed — app not healthy. Check logs:"
    echo "        docker compose logs app --tail 50"
    exit 1
  fi
  echo "  Waiting... ($COUNT/$RETRIES)"
  sleep 5
done

docker compose ps

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Rollback complete!"
echo ""
echo "  To also restore database backup:"
echo "    ls $BACKUP_DIR/"
echo "    bash deploy/backup.sh restore <backup_file.sql>"
echo "═══════════════════════════════════════════════════"
