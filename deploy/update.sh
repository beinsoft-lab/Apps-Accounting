#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# update.sh — Deploy app update with zero-downtime strategy
# Usage: bash update.sh
# Run from: /opt/beinsoft/accounting/
# ══════════════════════════════════════════════════════════════════════════════
set -e

DEPLOY_DIR="/opt/beinsoft/accounting"
BACKUP_DIR="/opt/beinsoft/backups/accounting"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

echo "═══════════════════════════════════════════════════"
echo "  Beinsoft Accounting — Update Deployment"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"

cd "$DEPLOY_DIR"
mkdir -p "$BACKUP_DIR"

# ── Save current image tag for rollback ───────────────────────────────────────
CURRENT_IMAGE=$(docker images beinsoft-accounting:latest --format "{{.ID}}" 2>/dev/null || echo "none")
echo "[info] Current image: $CURRENT_IMAGE"

# ── Backup database before update ─────────────────────────────────────────────
echo ""
echo "[1/5] Backing up database..."
source "$DEPLOY_DIR/.env"
docker compose exec -T mysql \
  mysqldump -u root --password="$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  > "$BACKUP_DIR/pre_update_${TIMESTAMP}.sql"
echo "[info] Backup saved: pre_update_${TIMESTAMP}.sql"

# ── Pull latest code ──────────────────────────────────────────────────────────
echo ""
echo "[2/5] Pulling latest code..."
git pull origin main

# ── Rebuild image ─────────────────────────────────────────────────────────────
echo ""
echo "[3/5] Building new Docker image..."
docker compose build

# ── Replace running app container (MySQL & nginx stay up) ─────────────────────
echo ""
echo "[4/5] Restarting app container..."
docker compose up -d --no-deps app

# ── Verify health ─────────────────────────────────────────────────────────────
echo ""
echo "[5/5] Verifying app health..."
RETRIES=24
COUNT=0
until docker inspect --format='{{.State.Health.Status}}' beinsoft_accounting_app 2>/dev/null | grep -q "healthy"; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$RETRIES" ]; then
    echo "[WARN] App did not become healthy in 2 minutes. Check logs:"
    echo "       docker compose logs app --tail 50"
    exit 1
  fi
  echo "  Waiting... ($COUNT/$RETRIES)"
  sleep 5
done

docker compose ps

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Update complete!"
echo "  Rollback: bash deploy/rollback.sh $CURRENT_IMAGE"
echo "═══════════════════════════════════════════════════"
