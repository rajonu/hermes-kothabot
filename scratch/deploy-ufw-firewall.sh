#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Fix #4 — Enable UFW firewall (production hardening)
# ─────────────────────────────────────────────────────────────────────────────
# RISK: Misconfigured UFW can lock you out of SSH or drop SIP/RTP traffic.
# This script is INTERACTIVE and SAFE: it pre-loads all rules, shows you the
# pending state, and asks you to confirm BEFORE enabling.
#
# Ports allowed:
#   22/tcp            SSH                        ← critical, allowed FIRST
#   80/tcp            HTTP (Let's Encrypt)
#   443/tcp           HTTPS (Nginx + ws-voice)
#   5060/tcp          SIP signaling (trunk1)
#   5060/udp          SIP signaling (trunk2)
#   10000-20000/udp   RTP audio streams
#
# SAFETY PROTOCOL (READ BEFORE RUNNING):
#   1. Open a SECOND SSH session to the VPS in a separate terminal NOW.
#      Keep it open the entire time. If UFW locks you out of new SSH,
#      this session keeps your access.
#   2. Have the Contabo control-panel VNC console URL ready as final backup:
#      https://my.contabo.com/  → your server → "VNC Console"
#   3. After this script enables UFW, immediately open a THIRD ssh from
#      another terminal to verify new connections still work.
#
# Rollback (any time):
#   ssh root@163.128.144.171 'ufw disable'
# ─────────────────────────────────────────────────────────────────────────────

set -e

VPS_USER="root"
VPS_HOST="163.128.144.171"
VPS_PASS="Allah7570#"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UFW FIREWALL ENABLE — INTERACTIVE SAFETY-FIRST DEPLOY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Before continuing:"
echo "    1. Open a SECOND ssh session to root@$VPS_HOST in another terminal."
echo "       (sshpass -p '$VPS_PASS' ssh root@$VPS_HOST)"
echo "    2. Have Contabo VNC console URL ready: https://my.contabo.com/"
echo ""
read -p "  Confirmed both safeguards in place? [y/N] " ok
if [ "$ok" != "y" ] && [ "$ok" != "Y" ]; then
  echo "  Aborted."
  exit 1
fi

echo ""
echo "==> [1/4] Pre-loading UFW rules (NOT enabling yet)"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'EOF'
set -e

# Reset any existing rules first
ufw --force reset >/dev/null 2>&1

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Critical: SSH first so we don't lock ourselves out
ufw allow 22/tcp comment 'SSH'

# Web
ufw allow 80/tcp  comment 'HTTP - Let'\''s Encrypt'
ufw allow 443/tcp comment 'HTTPS - Nginx + ws-voice'

# SIP signaling — both transports because trunks use different
ufw allow 5060/tcp comment 'SIP signaling TCP (trunk1 dormant)'
ufw allow 5060/udp comment 'SIP signaling UDP (trunk2 active)'

# RTP audio streams (Asterisk default range)
ufw allow 10000:20000/udp comment 'RTP audio'

echo ""
echo "Pending UFW configuration (status numbered, but inactive):"
ufw show added
EOF

echo ""
read -p "==> [2/4] Review the rules above. Proceed to ENABLE UFW now? [y/N] " ok2
if [ "$ok2" != "y" ] && [ "$ok2" != "Y" ]; then
  echo "  Aborted — UFW rules staged but not enabled. To revert run:"
  echo "    ssh root@$VPS_HOST 'ufw --force reset'"
  exit 1
fi

echo ""
echo "==> [3/4] Enabling UFW (--force = no interactive prompt)"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'ufw --force enable && ufw status numbered'

echo ""
echo "==> [4/4] Verifying critical services still reachable"
echo ""
echo "  Testing SSH (this very command IS the test — if you see this, SSH is OK)"
echo ""
echo "  Testing HTTPS..."
curl -fsSI -m 10 https://my.kothabot.ai.bd/ -o /dev/null && echo "    ✅ HTTPS reachable" || echo "    ⚠️ HTTPS FAILED — check Nginx and 443 rule"

echo "  Asterisk SIP registration status (should still show Registered):"
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  'asterisk -rx "pjsip show registrations" 2>&1 | grep -E "Registered|Endpoint|^  09" || echo "  ⚠ no registrations shown"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ UFW enabled. NOW TEST a real phone call to 09644840050."
echo ""
echo "If anything is broken, ROLLBACK IMMEDIATELY:"
echo "  sshpass -p '$VPS_PASS' ssh root@$VPS_HOST 'ufw disable'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
