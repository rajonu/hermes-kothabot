#!/bin/sh
set -e

# WhatsApp pairing must originate from a residential IP (WhatsApp blocks new
# device registration from datacenter/VPS ranges — verified empirically).
# PROXY_TUNNEL_HOSTNAME points at a Cloudflare Tunnel exposing a SOCKS5 proxy
# running on a residential network; cloudflared here is just the client that
# dials out to that tunnel and exposes it as a local port.
if [ -n "$PROXY_TUNNEL_HOSTNAME" ]; then
  echo "[start] launching cloudflared access tcp -> $PROXY_TUNNEL_HOSTNAME"
  /usr/local/bin/cloudflared access tcp --hostname "$PROXY_TUNNEL_HOSTNAME" --url 127.0.0.1:1080 &
  sleep 2
fi

exec node dist/index.js
