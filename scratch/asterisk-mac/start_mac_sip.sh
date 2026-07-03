#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
BRIDGE_DIR="$SCRIPT_DIR/bridge"

echo ""
echo "=========================================="
echo " KothaBot Mac SIP Stack — All-in-One"
echo "=========================================="

# ── 1. Stop Pi Asterisk to free the SIP registration slot ───────────────────
echo ""
echo "► Stopping Pi Asterisk (frees SIP registration)..."
ssh -i ~/.ssh/kothabot_gcp_key -o ConnectTimeout=6 raj@192.168.68.91 \
  "docker stop asterisk 2>/dev/null; pm2 stop kothabot-bridge 2>/dev/null; true" 2>/dev/null \
  && echo "  Pi services stopped." \
  || echo "  Pi unreachable (ok)."

# ── 2. Stop/remove existing Mac Asterisk container ──────────────────────────
echo ""
echo "► Cleaning up old containers..."
docker rm -f asterisk-mac 2>/dev/null && echo "  Removed old asterisk-mac." || echo "  No existing container."

# ── 3. Pull image ────────────────────────────────────────────────────────────
echo ""
echo "► Pulling Asterisk Docker image (andrius/asterisk)..."
docker pull andrius/asterisk:latest

# ── 4. Setup bridge ──────────────────────────────────────────────────────────
echo ""
echo "► Setting up bridge dependencies..."
mkdir -p "$BRIDGE_DIR"
cp "$SCRIPT_DIR/../bridge.js" "$BRIDGE_DIR/bridge.js"
cd "$BRIDGE_DIR"
if [ ! -f package.json ]; then npm init -y; fi
if [ ! -d node_modules/ws ]; then npm install ws uuid; fi
cd "$SCRIPT_DIR"

# ── 5. Get Mac local IP ──────────────────────────────────────────────────────
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.68.75")
echo ""
echo "► Mac local IP: $MAC_IP"

# ── 6. Start Asterisk on Mac ─────────────────────────────────────────────────
# On Mac Docker, --network=host doesn't work, so we publish ports manually.
# SIP signaling: 5060 TCP+UDP
# RTP media: 10000-10100 UDP (small range to avoid slow port-mapping)
echo ""
echo "► Starting Asterisk Docker container on Mac..."
docker run -d \
  --name asterisk-mac \
  -p 5060:5060/tcp \
  -p 5060:5060/udp \
  -p 10000-10050:10000-10050/udp \
  -v "$CONFIG_DIR:/etc/asterisk:ro" \
  --add-host=host.docker.internal:host-gateway \
  andrius/asterisk:latest

echo "  Waiting 6s for Asterisk to start..."
sleep 6

echo ""
echo "► Asterisk registration status:"
docker exec asterisk-mac asterisk -rx "pjsip show registrations" 2>/dev/null || true

# ── 7. Start bridge in foreground ────────────────────────────────────────────
echo ""
echo "========================================"
echo " Bridge starting — call 09617854561 now!"
echo "========================================"
echo ""
KOTHABOT_WSS_URL=wss://voice-server.up.railway.app node "$BRIDGE_DIR/bridge.js"
