#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# KothaBot Build 113 Deploy Script
# ─────────────────────────────────────────────────────────────────────────────
# Run this from your LOCAL macOS terminal (not on the VPS).
# It will:
#   1. SCP the patched bridge.js to the VPS
#   2. SSH in, git pull, rebuild web app, restart all PM2 services
#   3. Tail logs briefly to confirm clean startup
# ─────────────────────────────────────────────────────────────────────────────

set -e

VPS_USER="root"
VPS_HOST="163.128.144.171"
VPS_PASS="Allah7570#"

echo "==> [1/4] SCP bridge.js to VPS"
sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no \
  scratch/bridge.js "$VPS_USER@$VPS_HOST:/var/www/bridge/bridge.js"

echo "==> [2/4] SSH in, git pull + rebuild web"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'EOF'
set -e
cd /var/www/kothabot
git pull origin main
cd apps/web && pnpm run build
echo "==> Web build complete"
EOF

echo "==> [3/4] Restart all PM2 services"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'pm2 restart kothabot-web kothabot-bridge && pm2 list'

echo "==> [4/4] Verify bridge restarted cleanly (last 15 lines)"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'pm2 logs kothabot-bridge --lines 15 --nostream'

echo ""
echo "✅ Deploy complete. Test a phone call to confirm bridge still routes correctly."
echo "   Expected: '[config] Asterisk reloaded successfully.' in logs (no docker exec errors)."
