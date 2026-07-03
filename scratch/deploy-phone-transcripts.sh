#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Phone-Call Transcripts Deploy (Piece B)
# ─────────────────────────────────────────────────────────────────────────────
# Deploys: migration 017 + voice-server changes + web changes + bridge.js
#
# PRE-FLIGHT (do once, manually):
#   1. Open Supabase SQL Editor
#   2. Paste contents of supabase/migrations/017_voice_session_source.sql
#   3. Run. Verify "source" column exists on voice_sessions table.
#
# Then run this script LOCALLY:
#   ./scratch/deploy-phone-transcripts.sh
#
# Rollback (code only):  git reset --hard restore-piece-a-did-cleanup
# Rollback (DB):         alter table voice_sessions drop column source, drop column caller_did;
# ─────────────────────────────────────────────────────────────────────────────

set -e

VPS_USER="root"
VPS_HOST="163.128.144.171"
VPS_PASS="Allah7570#"

echo "==> [1/5] Confirming migration 017 has been applied to Supabase"
read -p "    Did you run 017_voice_session_source.sql in Supabase? [y/N] " ok
if [ "$ok" != "y" ] && [ "$ok" != "Y" ]; then
  echo "    Aborting. Apply the migration first, then re-run."
  exit 1
fi

echo "==> [2/5] SCP updated bridge.js to VPS"
sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no \
  scratch/bridge.js "$VPS_USER@$VPS_HOST:/var/www/bridge/bridge.js"

echo "==> [3/5] SSH: git pull + build voice-server + build web"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'EOF'
set -e
cd /var/www/kothabot
git pull origin main

echo "==> Building voice-server..."
cd apps/voice-server
npm install --no-audit --no-fund
npm run build

echo "==> Ensuring KOTHABOT_WEB_URL is set in voice-server .env..."
if ! grep -q '^KOTHABOT_WEB_URL=' .env 2>/dev/null; then
  echo "KOTHABOT_WEB_URL=http://127.0.0.1:3000" >> .env
  echo "    Added KOTHABOT_WEB_URL=http://127.0.0.1:3000"
else
  echo "    KOTHABOT_WEB_URL already configured."
fi

cd ../web
echo "==> Building web app..."
pnpm run build
EOF

echo "==> [4/5] Restart all 3 PM2 services"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'pm2 restart kothabot-voice kothabot-web kothabot-bridge && pm2 list'

echo "==> [5/5] Tail logs"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'pm2 logs kothabot-voice --lines 10 --nostream && echo "---" && pm2 logs kothabot-bridge --lines 10 --nostream'

echo ""
echo "✅ Deploy complete."
echo ""
echo "Test plan:"
echo "  1. Call 09644840050."
echo "  2. Talk for ~10 seconds, then hang up."
echo "  3. Wait 3-5 seconds, refresh https://my.kothabot.ai.bd/transcripts"
echo "  4. New entry should show with '📞 IP Phone · 9644840050' badge."
echo ""
echo "If transcript doesn't appear, check voice-server logs:"
echo "  ssh root@$VPS_HOST 'pm2 logs kothabot-voice | grep save-session'"
