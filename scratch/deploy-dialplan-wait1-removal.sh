#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Latency Fix #1 — Remove Wait(1) from Asterisk dialplan
# ─────────────────────────────────────────────────────────────────────────────
# Effect: Saves ~1s on every incoming call.
# Risk:   Near zero — single line commented out, instant reversibility.
#
# What this script does (on the VPS):
#   1. Backs up /etc/asterisk/extensions.conf → timestamped .bak
#   2. Comments out the single `same => n,Wait(1)` line in [kothabot-incoming]
#   3. Shows the diff before/after
#   4. Reloads Asterisk dialplan (NOT full core reload — safer, scoped)
#   5. Confirms the new dialplan is active
#
# ROLLBACK (if anything goes wrong):
#   ssh root@163.128.144.171
#   cp /etc/asterisk/extensions.conf.bak.<TIMESTAMP> /etc/asterisk/extensions.conf
#   asterisk -rx 'dialplan reload'
#
# Run from your LOCAL macOS terminal:
#   ./scratch/deploy-dialplan-wait1-removal.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

VPS_USER="root"
VPS_HOST="163.128.144.171"
VPS_PASS="Allah7570#"
TS=$(date +%Y%m%d-%H%M%S)

echo "==> Connecting to VPS..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash -s << EOF
set -e

CONF=/etc/asterisk/extensions.conf
BAK=/etc/asterisk/extensions.conf.bak.$TS

echo "==> [1/5] Backing up to \$BAK"
cp "\$CONF" "\$BAK"

echo "==> [2/5] Current Wait(1) line(s) in [kothabot-incoming]:"
grep -nE "Wait\(1\)" "\$CONF" || echo "  (none found — already removed?)"

echo "==> [3/5] Commenting out Wait(1)"
# Comment out only EXACT match: leading whitespace + "same => n,Wait(1)"
# Idempotent — won't double-comment if already prefixed with ;
sed -i.tmp -E 's|^([[:space:]]*)(same => n,Wait\(1\))$|\1;\2  ; disabled by latency-fix-1|' "\$CONF"
rm -f "\$CONF.tmp"

echo "==> [4/5] Diff (backup → current):"
diff "\$BAK" "\$CONF" || true

echo "==> [5/5] Reloading Asterisk dialplan"
asterisk -rx 'dialplan reload'
echo ""
echo "==> Verifying [kothabot-incoming] context:"
asterisk -rx 'dialplan show kothabot-incoming' | head -20
EOF

echo ""
echo "✅ Done. Now make a test call to one of the SIP DIDs:"
echo "   - 09617854561 (Automas)"
echo "   - 09644840050 (Alliance Dental)"
echo ""
echo "Expected: AI greets ~1 second sooner than before. Behavior otherwise unchanged."
echo ""
echo "ROLLBACK if needed:"
echo "  sshpass -p '$VPS_PASS' ssh root@$VPS_HOST \\"
echo "    'cp /etc/asterisk/extensions.conf.bak.$TS /etc/asterisk/extensions.conf && asterisk -rx \"dialplan reload\"'"
