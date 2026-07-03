# Session Memory & AI Handoff — KothaBot v2.0

*   **Author:** Antigravity (AI Coding Assistant)
*   **Date:** 2026-06-08 / 2026-06-09
*   **Version:** v1.0.0 · build 105
*   **Directory:** `/Users/rajrio/Desktop/dev/Claude-project/Kothabot-2.0`

---

## Session Overview & Completed Features

This session covered a **full production VPS migration** — moving the Web Dashboard, Voice Server, and Asterisk SIP Bridge from Railway to a self-hosted Contabo VPS — followed by debugging telephony audio, fixing shop DID matching, and reducing voice call startup latency.

---

### 1. Contabo VPS Provisioning & Full Stack Deployment

**VPS Details:**
- **Provider:** Contabo VPS
- **IP:** `163.128.144.171`
- **OS:** Ubuntu 22.04 LTS
- **SSH:** `root` / `Allah7570#`
- **Domain:** `my.kothabot.ai.bd` → Cloudflare DNS → `163.128.144.171`

**What was installed & deployed:**

| Service | Path on VPS | PM2 Name | Port |
|---|---|---|---|
| Next.js Web Dashboard | `/var/www/kothabot/apps/web` | `kothabot-web` | `:3000` |
| Voice Server (WS) | `/var/www/kothabot/apps/voice-server` | `kothabot-voice` | `:8080` |
| Asterisk Bridge | `/var/www/bridge/bridge.js` | `kothabot-bridge` | `:9092` (TCP) |
| Asterisk PBX | `/etc/asterisk/` | systemd `asterisk` | `:5060` (SIP) |
| Nginx Reverse Proxy | `/etc/nginx/sites-available/kothabot` | systemd `nginx` | `:443` (SSL) |

**Nginx Configuration:**
- `/` → `http://localhost:3000` (Next.js web)
- `/ws-voice` → `http://localhost:8080` (Voice Server WebSocket, `proxy_read_timeout 86400`)
- SSL via Let's Encrypt Certbot (auto-managed)
- Proxy buffer fix in `/etc/nginx/conf.d/proxy.conf` for large Supabase auth headers:
  ```
  proxy_buffer_size 128k;
  proxy_buffers 4 256k;
  proxy_busy_buffers_size 256k;
  ```

**Firewall:**
- Opened UDP ports `10000-20000` for Asterisk RTP audio streams
- Opened TCP/UDP port `5060` for SIP signaling

---

### 2. Asterisk SIP Telephony — Two Trunks Registered

Both SIP trunks are **successfully registered** (`Registered` status confirmed via `asterisk -rx 'pjsip show registrations'`):

| Trunk | DID Number | SIP Host | Transport | Status |
|---|---|---|---|---|
| Trunk 1 (Automas/BDIX) ⚠️ deprecated | `09617854561` | `202.40.176.2` | TCP | Registered but UNUSED |
| **Trunk 2 (Alliance Dental) — ACTIVE** | `09644840050` | `123.0.31.250` | UDP | ✅ In use |

**Asterisk Dialplan** (`/etc/asterisk/extensions.conf`):
- Catch-all context `[kothabot-incoming]`
- Pads the dialed number into a UUID format and passes it to `Audiosocket` on `127.0.0.1:9092`
- Includes `Ringing()` + `Wait(1)` + `Answer()` before AudioSocket handoff

**PJSIP Config** (`/etc/asterisk/pjsip.conf`):
- Full endpoint/aor/auth/identify/registration blocks for both trunks
- `rtp_symmetric=yes`, `force_rport=yes`, `rewrite_contact=yes` for NAT traversal
- Also includes `#include "/opt/kothabot/asterisk-config/pjsip_custom.conf"` for dynamic config from the Bridge

---

### 3. Bridge.js Fixes (Critical Bugs Found & Fixed)

**File:** `/var/www/bridge/bridge.js` (also saved locally at `scratch/bridge.js`)

#### Fix A: DID Number Matching (Leading Zero Strip)
**Problem:** When the SIP provider sends an incoming call, the DID arrives as `9644840050` (without leading zero). But the shop database stores the number as `09644840050` (with leading zero). The original bridge did an exact string match, so it NEVER matched — falling back to a generic blank AI with no greeting, no knowledge base, and no business identity.

**Fix:** Updated the matching loop to strip leading zeros from both the incoming DID and the stored shop number before comparing:
```javascript
const incomingNorm = String(didOrShopId).replace(/^0+/, '');
for (const shop of Object.values(shopCache)) {
  const shopNorm = String(shop.number || '').replace(/^0+/, '');
  if (shopNorm === incomingNorm && shopNorm !== '') {
    shopConfig = shop;
    break;
  }
}
```

#### Fix B: Bridge Connecting to Wrong Voice Server
**Problem:** The bridge `.env` file still pointed `KOTHABOT_WSS_URL` to the old Railway voice server (`wss://voice-server.up.railway.app`). Since Railway cold-starts sleeping services, this added 10–15 seconds of latency.

**Fix:** Updated `/var/www/bridge/.env` to use localhost:
```
KOTHABOT_WSS_URL=ws://127.0.0.1:8080/ws-voice
KOTHABOT_WEB_URL=http://127.0.0.1:3000
```
This eliminated all network latency between Bridge ↔ Voice Server (now 0ms, same machine).

**Result:** Call startup time dropped from **18 seconds → 9 seconds**. The remaining 9s is the baseline Gemini Live API initialization time (unavoidable — it must read the entire knowledge base and generate the first audio greeting).

---

### 4. UI Redesign — Telephony Panel

**File:** `apps/web/app/(dashboard)/integrations/TelephonyPanel.tsx`

Changes:
- Renamed "SIP Telephony Trunk" → **"IP Phone Connection"**
- Renamed "Registered Number" → **"IP Phone Number"**
- Renamed "Connect SIP Trunk" button → **"Connect Phone"**
- Renamed "Run Diagnostics" button → **"🧪 Run Test"**
- Simplified connect form title to **"IP Phone Configuration"**
- Simplified info section title to **"IP Phone Information"**
- Simplified diagnostic result message to **"Connected successfully. No issues detected!"**
- Updated description text to **"Add your IP phone number and connect to route incoming voice calls to your KothaBot AI Assistant."**

---

### 5. 502 Bad Gateway Fix (Nginx Proxy Buffers)

**Problem:** After deploying to VPS, loading the dashboard returned `502 Bad Gateway nginx/1.18.0 (Ubuntu)`.

**Root Cause:** Supabase auth cookies/headers are very large (JWT tokens). Nginx's default `proxy_buffer_size` of 4k was too small, causing Nginx to reject the upstream response.

**Fix:** Created `/etc/nginx/conf.d/proxy.conf`:
```nginx
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

---

## Technical Details & Learnings

### A. VPS Architecture (All-in-One)
All three services (Web, Voice Server, Bridge) run on the same VPS. The Bridge communicates with the Voice Server over `127.0.0.1` (localhost), eliminating all WAN latency. The Voice Server communicates with Google Gemini Live API over the internet (unavoidable).

```
Phone Call → SIP Provider → Asterisk (:5060)
                                ↓
                          AudioSocket TCP (:9092)
                                ↓
                          bridge.js (PM2)
                                ↓ ws://127.0.0.1:8080/ws-voice
                          voice-server (PM2)
                                ↓ wss://
                          Google Gemini Live API
                                ↓
                          Audio response back through same chain
```

### B. Voice Call Startup Latency Breakdown (~9 seconds total)
1. **Telecom routing (1-2s):** SIP provider routes call to Asterisk
2. **Asterisk dialplan (1s):** `Ringing()` + `Wait(1)` + `Answer()` + UUID padding
3. **Bridge → Voice Server WS (0ms):** localhost connection, near-instant
4. **Voice Server → Gemini API (2-3s):** Opens secure WebSocket to Google, uploads system instruction + knowledge base
5. **Gemini generates greeting audio (2-3s):** Generates the first TTS audio chunk

### C. PM2 Process Management
```bash
pm2 list                    # see all 3 services
pm2 logs kothabot-bridge    # bridge logs
pm2 logs kothabot-voice     # voice server logs
pm2 logs kothabot-web       # web dashboard logs
pm2 restart kothabot-bridge # restart bridge after changes
```

---

## AI Handoff — Context for Future Agents

If you are continuing work on this codebase in a future session, please review these key details:

1.  **VPS Access:** SSH into the Contabo VPS with `sshpass -p 'Allah7570#' ssh -o StrictHostKeyChecking=no root@163.128.144.171`. All services are managed via PM2.
2.  **Bridge Code Location:** Source-of-truth lives in git at `scratch/bridge.js`. The VPS runs a copy at `/var/www/bridge/bridge.js` (managed by PM2). The VPS copy is NOT auto-deployed by `git pull` — you must SCP `scratch/bridge.js` to `/var/www/bridge/bridge.js` after pulling, then `pm2 restart kothabot-bridge`.
3.  **Web & Voice Code Location:** Deployed from the git repo at `/var/www/kothabot/` on the VPS. To deploy changes: push to git, then SSH in and `cd /var/www/kothabot && git pull && cd apps/web && pnpm run build && pm2 restart kothabot-web`.
4.  **Asterisk Config:** `/etc/asterisk/pjsip.conf` (SIP trunks), `/etc/asterisk/extensions.conf` (dialplan). Reload with `asterisk -rx 'core reload'`.
5.  **SSL Certificates:** Managed by Let's Encrypt Certbot. Auto-renew is configured.
6.  **Domain DNS:** `my.kothabot.ai.bd` points to `163.128.144.171` via Cloudflare (A record, proxied).
7.  **Testing Paid Flows:** To test the registration flow from scratch, **always use a brand new email address** (e.g., via Incognito window Google OAuth).
8.  **Middleware File Name:** Next.js 16 uses `apps/web/proxy.ts` as the middleware file. **Do not create `middleware.ts`**.
9.  **Call Latency:** The 9-second startup delay for phone calls is normal — it's the Gemini Live API initialization time. Subsequent responses within the same call are sub-1-second.
10. **Bridge DID Matching:** The bridge now strips leading zeros when matching incoming DIDs to shop phone numbers. If a new shop is added, the bridge auto-refreshes its config cache every 5 minutes from the web API.

---

## SIP Trunk Telephony — Current Status

### ✅ Fully Operational
- Two SIP trunks registered and receiving calls
- Bridge correctly matches incoming DIDs to shops (with leading-zero normalization)
- AI greets callers with the correct business identity, in Bangla/English
- Audio flows bidirectionally (8kHz G.711 ↔ 24kHz PCM resampling in bridge.js)
- Full call transcripts, order extraction, and session analytics saved to Supabase

### Known Limitations
- **Startup latency (~9s):** Gemini Live API initialization. Can be reduced by shortening the knowledge base text.
- **Bridge is not in git:** `bridge.js` lives only on the VPS at `/var/www/bridge/bridge.js` and locally at `scratch/bridge.js`. Changes must be manually SCP'd to the VPS.
- **Asterisk system-config sync:** The bridge tries to run `docker exec asterisk-server asterisk -rx 'core reload'` which fails because Asterisk runs natively, not in Docker. This is a cosmetic error in logs only — the actual SIP config works fine.

---

## Performance Audit — 2026-06-10 (Claude, Principal-Architect pass)

Full read-through of web app, voice server, bridge, migrations, and deploy config. **No code changed yet** — this is the analysis + prioritized refactor plan.

### 🔴 Critical (do first)

1. **Missing DB indexes on the hottest tables.** Migration 001 created ZERO indexes. `orders`, `customers`, `voice_sessions`, `training_data`, `knowledge_chunks` have no `shop_id` index — every dashboard query is a sequential scan that gets slower as tenants grow. (Later migrations only indexed products, subscriptions, api_keys, webhooks, and two partial voice_sessions indexes.)
   **Fix:** new migration `017_performance_indexes.sql`:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_orders_shop_created    ON orders(shop_id, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_orders_shop_status     ON orders(shop_id, status);
   CREATE INDEX IF NOT EXISTS idx_customers_shop         ON customers(shop_id);
   CREATE INDEX IF NOT EXISTS idx_voice_sessions_shop_created ON voice_sessions(shop_id, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_training_data_shop     ON training_data(shop_id);
   CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_shop  ON knowledge_chunks(shop_id);
   CREATE INDEX IF NOT EXISTS idx_shops_owner            ON shops(owner_id);
   ```

2. **Dashboard layout runs ~11 Supabase round-trips on EVERY page navigation.** `app/(dashboard)/layout.tsx` is `force-dynamic` and fetches user, shop, subscription, full `training_data` + all `products` + all `knowledge_chunks` (just to embed `trainingData` into the VoiceWidget props), plus 5 count queries — each an HTTPS round trip from VPS → Supabase cloud. This is the #1 cause of slow page-to-page navigation.
   **Fix:** (a) merge the two sequential `Promise.all` blocks into one; (b) move trainingData assembly out of the layout into a lazy endpoint (e.g. `GET /api/widget-context`) the VoiceWidget fetches only when opened; (c) cache shop+subscription per request/short TTL.

3. **`/api/voice/telephony-sync` selects ALL shops then filters in JS.** Should filter in SQL: `.filter('ai_config->telephony->>status', 'eq', 'active')`. Also: response includes SIP passwords, and the Bearer token has a **hardcoded fallback** (`'kothabot-voip-secret-token-2026'`) if `GATEWAY_TOKEN` is unset — set the env var and remove the fallback.

### 🟠 High

4. **74 occurrences of `select('*')`** across API routes/pages — over-fetching wide rows (shops.ai_config can be large). Replace with explicit column lists on hot paths first (dashboard pages, v1 API).
5. **Revenue computed in JS** (`dashboard/page.tsx` fetches all completed order rows this month and reduces). Use a Postgres aggregate (`.select('total_amount.sum()')` or an RPC).
6. **257 KB `favicon.png` + 257 KB `kotha-logo.png`** in `apps/web/public/` shipped to every visitor. Compress to <20 KB WebP/PNG; favicon should be ~32px.
7. **Blanket `no-cache` headers on ALL HTML** (next.config.ts) — combined with force-dynamic layouts means zero caching anywhere. Keep for dashboard, but allow caching on landing/public/voice-link pages.
8. **`images.remotePatterns hostname: '**'`** — the Next image optimizer is an open proxy for any URL (abuse/cost risk). Restrict to Supabase storage + known hosts.

### 🟡 Medium

9. **In-memory rate limiter** (`lib/api-rate-limit.ts`) — works on single PM2 fork only. Breaks under cluster mode or restart; document constraint (keep `kothabot-web` at 1 instance) or move to Redis.
10. **Webhook delivery is fire-and-forget inline with no retry queue** (`lib/webhook-delivery.ts`). Fine on PM2 (process persists), but failed deliveries are never retried. Add a simple retry cron over `webhook_deliveries` failures.
11. **No background job/queue system** — backups, transcript cleanup rely on external cron hitting secret endpoints. Acceptable; consider a PM2 cron process for reliability.
12. **Voice server timer hygiene is good** (chunking 90s, inactivity 40s, KB capped at KB_CHAR_LIMIT). The 9s call startup remains the Gemini Live baseline; only mitigations are shorter KB and pre-warmed greeting audio.
13. **Bridge** caches shop configs 5 min and talks to web/voice over localhost — solid. Only risk: deploy drift (manual SCP).

### ✅ Already good
- Parallel `Promise.all` query batching is used widely; static chunks cached immutable; `optimizePackageImports` for lucide/radix; API keys SHA-256 hashed with index on `key_hash`; bridge localhost networking; voice session chunking/cost protection.

### Recommended execution order
1. Migration 017 indexes (zero risk, biggest DB win)
2. Layout refactor: single Promise.all + lazy widget trainingData
3. telephony-sync SQL filter + remove token fallback
4. Image compression (favicon/logo)
5. select('*') cleanup on hot paths + revenue aggregate
6. remotePatterns restriction

### ✅ Fix pass applied — 2026-06-10 (same session)

Restore point: **git tag `thanks`** (commit 8d94ffe, docs-only state before refactor). To roll back: `git reset --hard thanks`.

What was changed (build + tsc verified green):
1. **`supabase/migrations/017_performance_indexes.sql`** — NEW. ⚠️ Must be run in Supabase SQL Editor (indexes on orders, customers, voice_sessions, training_data, knowledge_chunks, shops.owner_id).
2. **`app/(dashboard)/layout.tsx`** — removed training_data/products/knowledge_chunks fetching + assembly; subscription + 5 counts merged into ONE `Promise.all`; shop query now selects explicit columns (`id, name, category, ai_config, widget_config`). Layout went from ~11 queries in 4 waves → 8 queries in 3 waves with no large payloads.
3. **`lib/widget-training.ts`** — NEW shared trainingData builder (same logic the layout used).
4. **`app/api/voice/widget-context/route.ts`** — NEW authed endpoint returning the logged-in shop's trainingData.
5. **`components/voice/VoiceWidget.tsx`** — new `lazyContext` prop (dashboard passes it); fetches `/api/voice/widget-context` on first call start, caches in a ref. Embeddable widget + voice-link pages unchanged (still pass trainingData prop).
6. **`api/voice/telephony-sync/route.ts`** — SQL-side filter `.eq('ai_config->telephony->>status', 'active')` instead of fetching all shops. Token fallback KEPT deliberately (bridge.js uses the same default; removing one-sided would break live telephony). Hardening step: set `GATEWAY_TOKEN` in web `.env.local` AND `/var/www/bridge/.env`, restart both, then delete fallback.
7. **`public/favicon.png`** 257 KB → 7 KB (64px); **`public/kotha-logo.png`** 257 KB → 47 KB (192px; rendered at 32px).
8. **`next.config.ts`** — `images.remotePatterns` restricted from `'**'` to `jrlfbfejeccsixnxhuwo.supabase.co`.

Still open (deliberately deferred): bulk `select('*')` cleanup (74 sites — needs per-route care), revenue DB aggregate (PostgREST aggregates flag is off by default), Redis rate limiter, webhook retry cron.

Deploy notes: run migration 017 first, then normal VPS deploy (`git pull && pnpm run build && pm2 restart kothabot-web`). No voice-server or bridge changes in this pass.
