# KothaBot Infrastructure Map

> Last updated: 2026-06-30 · build 196

## Where everything runs

| Service | Platform | Address | Process manager |
|---|---|---|---|
| **Next.js web app** | Railway | `https://my.kothabot.ai.bd` | Railway (auto-deploy from `main`) |
| **Voice server** (Gemini Live WS) | Railway | `wss://voice-server.up.railway.app/ws-voice` | Railway (auto-deploy from `main`) |
| **WhatsApp bot-server** (Baileys) | Contabo VPS `163.128.144.171` | `http://163.128.144.171:9092` (internal only, called by web via `BOT_SERVER_URL`) | PM2 `kothabot-bot-server` |
| **SIP bridge** (Asterisk ↔ Voice Server) | Contabo VPS `163.128.144.171` | TCP `:9092` AudioSocket (different port namespace from bot-server — bridge listens 9092 internally via Asterisk dialplan, see CLAUDE.md) | PM2 `kothabot-bridge` |
| **Asterisk PBX** | Contabo VPS `163.128.144.171` | SIP `:5060` | systemd |
| **Nginx** | Contabo VPS `163.128.144.171` | `:443` reverse proxy | systemd |
| **Residential SOCKS5 proxy** (microsocks) | Raspberry Pi `192.168.68.91` (home, behind Deco mesh router) | `0.0.0.0:1080` | background process (NOT systemd yet — see Known Gaps) |
| **Cloudflare Tunnel client** (Pi side) | Raspberry Pi `192.168.68.91` | exposes `socks.d4f.me` ingress → `tcp://127.0.0.1:1080` | systemd `cloudflared.service` |
| **Cloudflare Tunnel access client** (VPS side) | Contabo VPS `163.128.144.171` | dials `socks.d4f.me`, exposes locally on `127.0.0.1:1080` | spawned by `start.sh` inside PM2 `kothabot-bot-server` (not separate PM2 process) |

## WhatsApp proxy chain (why it exists)

WhatsApp blocks new-device registration from datacenter/VPS IP ranges. Bot-server runs on a VPS, so its outbound Baileys connection is routed through a residential IP via this chain:

```
bot-server (VPS, Baileys)
  → 127.0.0.1:1080 (cloudflared access tcp client, launched by start.sh)
  → Cloudflare Tunnel (socks.d4f.me)
  → cloudflared.service (Pi)
  → microsocks on 0.0.0.0:1080 (Pi)
  → Pi's home ISP IP (103.187.94.66, Bangladesh residential)
  → WhatsApp servers (sees a residential IP, allows pairing)
```

Config:
- VPS: `/var/www/kothabot/apps/bot-server/.env` → `PROXY_URL=socks5://127.0.0.1:1080`, `PROXY_TUNNEL_HOSTNAME=socks.d4f.me`
- VPS: `/var/www/kothabot/ecosystem.config.js` — PM2 env block, same values
- Pi: `/etc/cloudflared/config.yml` — ingress rule `socks.d4f.me → tcp://127.0.0.1:1080` (must be `127.0.0.1`, NOT `localhost` — cloudflared resolves `localhost` to IPv6 `[::1]` and microsocks only binds IPv4, causing silent connection-refused failures)

## Raspberry Pi (home server) — full picture

Static LAN IP `192.168.68.91`, DHCP-visible to router as `192.168.68.57` (Deco mesh sees a different address than the Pi's own static config — use `.57` for router-side port-forward rules if ever needed, `.91` for direct SSH/local browsing).

SSH: `ssh -i ~/.ssh/pi_access raj@192.168.68.91`

Already documented in the Obsidian vault (`/Users/rajrio/Desktop/milkyway/Milkyway/wiki/concepts/home-server-infra.md`) — runs Home Assistant, CasaOS, Portainer, Pi-hole, FreeLLM proxy, Hermes Agent, and (new as of this session) **microsocks** for the WhatsApp proxy.

Cloudflare Tunnel ID `781e4e40-f3d7-48eb-9347-eebe28b04293` fronts 10 routes at `*.d4f.me`, including the new `socks.d4f.me` ingress added for this proxy.

## Known gaps / fragility

1. **Microsocks has no systemd unit.** It was started as a background `&` process over SSH. If the Pi reboots or the process dies, WhatsApp pairing breaks silently (bot-server just loops "disconnected, reconnecting"). **TODO: create `/etc/systemd/system/microsocks.service` with `Restart=always` and `WantedBy=multi-user.target`.**
2. **Port forwarding via Deco was tried and abandoned** in favor of the Cloudflare Tunnel approach — there is no port-forward rule active on the home router. Don't re-add one unless explicitly switching strategy again.
3. **cloudflared access client on the VPS is not a separate PM2 process** — it's a background `&` job spawned inside `start.sh`, child of the `kothabot-bot-server` PM2 process. If bot-server is killed ungracefully (not via `pm2 restart`/`pm2 delete`), the cloudflared child can be orphaned and keep holding port 1080, causing `EADDRINUSE` on next start. If bot-server won't bind to the proxy after a crash, check `ps aux | grep cloudflared` on the VPS and kill stale instances before restarting.
4. **GATEWAY_TOKEN** for `/api/voice/telephony-sync` still has an insecure hardcoded fallback (carried over from earlier perf audit, see CLAUDE.md § Performance Audit).

## Quick diagnostic commands

```bash
# VPS: bot-server status + logs (password in CLAUDE.md, not repeated here)
ssh root@163.128.144.171 "pm2 list && pm2 logs kothabot-bot-server --lines 50 --nostream"

# VPS: confirm proxy chain is alive
ssh root@163.128.144.171 "curl -x socks5h://127.0.0.1:1080 -s -o /dev/null -w 'HTTP:%{http_code}\n' https://www.google.com"

# Pi: confirm microsocks + tunnel are up
ssh -i ~/.ssh/pi_access raj@192.168.68.91 "ps aux | grep -E 'microsocks|cloudflared' | grep -v grep && sudo netstat -tlnp | grep 1080"

# Pi: restart microsocks if it died (no systemd yet — manual restart)
ssh -i ~/.ssh/pi_access raj@192.168.68.91 "sudo lsof -i :1080 -t | xargs -r sudo kill -9; sleep 1; sudo /usr/local/bin/microsocks -i 0.0.0.0 -p 1080 > /tmp/microsocks.log 2>&1 &"
```
