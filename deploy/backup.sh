#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# backup.sh — MySQL database backup & restore
# Usage:
#   bash backup.sh                 → create a new backup (timestamped)
#   bash backup.sh restore <file>  → restore from a specific .sql file
# Run from: /opt/beinsoft/accounting/
# ══════════════════════════════════════════════════════════════════════════════
set -e

DEPLOY_DIR="/opt/beinsoft/accounting"
BACKUP_DIR="/opt/beinsoft/backups/accounting"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
KEEP_DAYS=30

# ── Load env vars ─────────────────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "[ERROR] .env not found at $DEPLOY_DIR/.env"
  exit 1
fi
source "$DEPLOY_DIR/.env"

mkdir -p "$BACKUP_DIR"

# ──────────────────────────────────────────────────────────────────────────────
# RESTORE
# ──────────────────────────────────────────────────────────────────────────────
if [ "$1" = "restore" ]; then
  RESTORE_FILE="${2:-}"
  if [ -z "$RESTORE_FILE" ]; then
    echo "[ERROR] Specify backup file to restore."
    echo "        Usage: bash backup.sh restore /opt/beinsoft/backups/accounting/backup_20260618_120000.sql"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null || echo "  (none found)"
    exit 1
  fi

  if [ ! -f "$RESTORE_FILE" ]; then
    echo "[ERROR] File not found: $RESTORE_FILE"
    exit 1
  fi

  echo "═══════════════════════════════════════════════════"
  echo "  Beinsoft Accounting — Database Restore"
  echo "  File   : $RESTORE_FILE"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════════════"
  echo ""
  echo "[WARN] This will OVERWRITE the current database: $MYSQL_DATABASE"
  read -p "       Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi

  echo ""
  echo "Restoring..."
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T mysql \
    mysql -u root --password="$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
    < "$RESTORE_FILE"

  echo ""
  echo "Restore complete from: $RESTORE_FILE"
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# BACKUP (default)
# ──────────────────────────────────────────────────────────────────────────────
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "═══════════════════════════════════════════════════"
echo "  Beinsoft Accounting — Database Backup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"

echo ""
echo "[1/3] Dumping database $MYSQL_DATABASE..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T mysql \
  mysqldump \
    -u root \
    --password="$MYSQL_ROOT_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    "$MYSQL_DATABASE" \
  > "$BACKUP_FILE"

echo "[info] Backup saved: $BACKUP_FILE"
echo "[info] Size: $(du -sh "$BACKUP_FILE" | cut -f1)"

# ── Compress ──────────────────────────────────────────────────────────────────
echo ""
echo "[2/3] Compressing..."
gzip "$BACKUP_FILE"
echo "[info] Compressed: ${BACKUP_FILE}.gz"
echo "[info] Size: $(du -sh "${BACKUP_FILE}.gz" | cut -f1)"

# ── Prune old backups ─────────────────────────────────────────────────────────
echo ""
echo "[3/3] Pruning backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)
echo "[info] Backups remaining: $REMAINING"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Backup complete!"
echo "  File: ${BACKUP_FILE}.gz"
echo ""
echo "  To restore:"
echo "    bash deploy/backup.sh restore ${BACKUP_FILE}.gz"
echo "    (gunzip first: gunzip ${BACKUP_FILE}.gz)"
echo "═══════════════════════════════════════════════════"
