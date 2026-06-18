#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# ssl-renew.sh — Auto-renew SSL certificate via certbot
# Usage:
#   bash ssl-renew.sh           → renew jika cert < 30 hari expired
#   bash ssl-renew.sh --force   → force renew sekarang
# Setup cron (jalankan 2x sehari, certbot skip jika belum perlu):
#   0 3,15 * * * bash /opt/beinsoft/accounting/deploy/ssl-renew.sh >> /opt/beinsoft/shared/logs/ssl-renew.log 2>&1
# ══════════════════════════════════════════════════════════════════════════════
set -e

DEPLOY_DIR="/opt/beinsoft/accounting"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] [ssl-renew]"
FORCE="${1:-}"

echo "$LOG_PREFIX Starting SSL renewal check..."

# ── Stop nginx ────────────────────────────────────────────────────────────────
echo "$LOG_PREFIX Stopping nginx (port 80 needed by certbot)..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" stop nginx

# ── Renew cert ────────────────────────────────────────────────────────────────
if [ "$FORCE" = "--force" ]; then
  echo "$LOG_PREFIX Force renewing..."
  certbot renew --standalone --force-renewal
else
  echo "$LOG_PREFIX Checking renewal eligibility..."
  certbot renew --standalone
fi

CERTBOT_EXIT=$?

# ── Restart nginx (always, even if certbot fails) ─────────────────────────────
echo "$LOG_PREFIX Restarting nginx..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" start nginx

if [ $CERTBOT_EXIT -ne 0 ]; then
  echo "$LOG_PREFIX ERROR: certbot exited with code $CERTBOT_EXIT"
  exit $CERTBOT_EXIT
fi

echo "$LOG_PREFIX Done."
