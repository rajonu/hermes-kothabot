#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Fix #3 Verify — Voice-server aiModel empty-string fallback
# ─────────────────────────────────────────────────────────────────────────────
# Commit 8402cf7 added: if config.aiModel is empty string, fall back to
# DEFAULT_MODEL instead of passing '' to Gemini (which crashed sessions).
#
# This script verifies:
#   1. That commit is in the deployed git history on the VPS
#   2. The compiled dist/gemini/client.js contains the fallback logic
#   3. PM2 voice-server is running and recently restarted
#   4. The most recent session log shows a successful model selection
#
# Read-only. No changes to VPS.
# ─────────────────────────────────────────────────────────────────────────────

set -e

VPS_USER="root"
VPS_HOST="163.128.144.171"
VPS_PASS="Allah7570#"

echo "==> [1/4] Confirm commit 8402cf7 is in deployed history"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'cd /var/www/kothabot && git log --oneline | grep -E "8402cf7|fallback to DEFAULT_MODEL" | head -3 || echo "  ❌ commit not found in deployed history!"'

echo ""
echo "==> [2/4] Check compiled dist for fallback logic"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'grep -n "DEFAULT_MODEL\|aiModel" /var/www/kothabot/apps/voice-server/dist/gemini/client.js 2>&1 | head -5 || echo "  ⚠ dist file missing — voice-server not built?"'

echo ""
echo "==> [3/4] PM2 voice-server status"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'pm2 jlist | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f\"  name={p[chr(39)+\"name\"+chr(39)]} status={p[chr(39)+\"pm2_env\"+chr(39)][chr(39)+\"status\"+chr(39)]} restarts={p[chr(39)+\"pm2_env\"+chr(39)][chr(39)+\"restart_time\"+chr(39)]} uptime_ms={p[chr(39)+\"pm2_env\"+chr(39)][chr(39)+\"pm_uptime\"+chr(39)]}\") for p in d if p[chr(39)+\"name\"+chr(39)]==\"kothabot-voice\"]" 2>/dev/null || pm2 list | grep voice'

echo ""
echo "==> [4/4] Recent voice-server logs — look for model selection messages"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'pm2 logs kothabot-voice --lines 60 --nostream 2>&1 | grep -iE "model|aiModel|DEFAULT|session ready" | tail -15 || echo "  (no model-related log lines in last 60)"'

echo ""
echo "✅ Verification done."
echo ""
echo "Expected results:"
echo "  [1] commit 8402cf7 shown"
echo "  [2] DEFAULT_MODEL referenced in dist/gemini/client.js"
echo "  [3] kothabot-voice status=online"
echo "  [4] recent 'session ready' messages with no aiModel errors"
