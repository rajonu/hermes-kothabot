# KothaBot v2.0 — Developer Handoff

> AI-powered voice assistant SaaS for Bangladeshi small businesses.
> Customers call a floating widget on any merchant website and talk to an AI.
> Businesses can also connect their IP phone number for SIP telephony.

---

## Quick Start (Local Development)

```bash
# 1. Clone
git clone https://github.com/rajonu/kothabot-2.0.git
cd kothabot-2.0

# 2. Install (web app)
cd apps/web && npm install

# 3. Set env vars (copy and fill in)
cp .env.example .env.local   # or create manually

# 4. Start web (port 3001 — port 3000 may be taken)
PORT=3001 npm run dev

# 5. Start voice server (new terminal)
cd ../voice-server && npm install && npm run dev
```

---

## Production Server (Contabo VPS)

All services run on a self-hosted Contabo VPS:

| Detail | Value |
|---|---|
| **IP** | `163.128.144.171` |
| **SSH** | `root` / `Allah7570#` |
| **Domain** | `my.kothabot.ai.bd` |
| **Node.js** | v20.20.2 |

### SSH Access
```bash
sshpass -p 'Allah7570#' ssh -o StrictHostKeyChecking=no root@163.128.144.171
```

### PM2 Services
```bash
pm2 list                     # see all services
pm2 logs kothabot-web        # web dashboard logs
pm2 logs kothabot-voice      # voice server logs
pm2 logs kothabot-bridge     # telephony bridge logs
pm2 restart kothabot-web     # restart after deploy
```

### Deploy to Production
```bash
# On VPS:
cd /var/www/kothabot && git pull
cd apps/web && pnpm run build && pm2 restart kothabot-web
# For voice server: cd apps/voice-server && npm run build && pm2 restart kothabot-voice
# For bridge: edit scratch/bridge.js locally, then SCP to /var/www/bridge/bridge.js
```

---

## Architecture

```
Browser ──HTTPS──► Nginx (:443)
                    ├── / ──► Next.js (:3000) ──► Supabase (cloud)
                    └── /ws-voice ──► Voice Server (:8080) ──► Gemini Live API

Phone ──SIP──► Asterisk (:5060)
                └── AudioSocket ──► bridge.js (:9092) ──► Voice Server (:8080)
```

### Monorepo (`pnpm` + Turborepo)
```
apps/
  web/           Next.js 16 — dashboard + public widget pages
  voice-server/  Node.js WS — proxies Gemini, never exposes API key to browser
scratch/
  bridge.js      Asterisk ↔ Voice Server bridge (NOT in monorepo build, lives on VPS)
supabase/
  migrations/    001–016 SQL migrations, run in Supabase SQL Editor
```

---

## Environment Variables

### `apps/web/.env.local`
| Key | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (server-side only) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `NEXT_PUBLIC_APP_URL` | App URL e.g. `https://my.kothabot.ai.bd` |
| `NEXT_PUBLIC_VOICE_SERVER_URL` | WS URL e.g. `wss://my.kothabot.ai.bd/ws-voice` |
| `NEXT_PUBLIC_GEMINI_API_KEY` | For widget-level calls |
| `ADMIN_PIN` | For admin panel access |

### `apps/voice-server/.env`
| Key | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key |
| `PORT` | 8080 |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins |

### `/var/www/bridge/.env` (VPS only)
| Key | Description |
|---|---|
| `KOTHABOT_WSS_URL` | `ws://127.0.0.1:8080/ws-voice` (localhost!) |
| `KOTHABOT_WEB_URL` | `http://127.0.0.1:3000` (localhost!) |

---

## Key Technical Decisions

### Gemini Live API
- **Model:** `models/gemini-2.5-flash-native-audio-preview-12-2025` (configurable per shop in admin)
- **SDK:** `@google/genai` with `httpOptions: { apiVersion: 'v1beta' }`
- **CRITICAL:** `responseModalities: ['AUDIO']` ONLY — adding TEXT causes error 1011
- **Session chunking:** Every 90s the voice server summarizes + restarts Gemini session to prevent slowdown

### Auth Middleware
- File is `proxy.ts` (not `middleware.ts`) — Next.js 16 renamed it
- Public routes: `/login`, `/register`, `/onboarding`, `/widget`

### Supabase Clients
```typescript
createClient()       // server client with cookies — for Server Components
createAdminClient()  // bypasses RLS — for widget page, admin panel
```

### SIP Telephony
- **Asterisk PBX** handles SIP registration and call routing
- **bridge.js** resamples audio (8kHz ↔ 24kHz) and bridges to Voice Server via localhost WebSocket
- **DID matching** strips leading zeros (e.g., `09644840050` matches `9644840050`)
- **Config refresh:** bridge polls `/api/voice/telephony-sync` every 5 minutes

---

## Routes

| Route | Description | Auth |
|---|---|---|
| `/` | Redirects to `/dashboard` | Required |
| `/login`, `/register`, `/onboarding` | Auth flow | Public |
| `/dashboard` | Overview with live stats | Required |
| `/orders`, `/customers`, `/products` | Data pages | Required |
| `/analytics` | Call analytics + cost protection | Required |
| `/transcripts` | Voice call transcript viewer | Required |
| `/training` | AI Knowledge Base | Required |
| `/integrations` | IP Phone + API Access + Webhooks | Required |
| `/voice-links` | Shareable voice call links | Required |
| `/billing` | Subscription & payment | Required |
| `/settings` | Shop config + backup | Required |
| `/widget/[shopId]` | Customer-facing voice widget | **Public** |
| `/v/[slug]` | Public voice link page | **Public** |
| `/admin` | Master admin panel | Required + PIN |

---

## Asterisk Configuration (VPS)

### Registered SIP Trunks
| Trunk | DID | Host | Status |
|---|---|---|---|
| trunk1 ⚠️ deprecated | `09617854561` | `202.40.176.2` (TCP) | Registered but unused |
| **trunk2 (ACTIVE)** | `09644840050` | `123.0.31.250` (UDP) | ✅ In use |

### Key Commands
```bash
asterisk -rx 'pjsip show registrations'   # check status
asterisk -rx 'core reload'                 # reload after config change
```

### Config Files
- `/etc/asterisk/pjsip.conf` — SIP trunk definitions
- `/etc/asterisk/extensions.conf` — call routing dialplan

---

## Phase Progress

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Done | Foundation — auth, routing, dashboard layout |
| 2 | ✅ Done | Real data — orders, customers, analytics, settings |
| 3 | ✅ Done | Voice AI — Gemini Live + session chunking |
| 4 | ✅ Done | Widget embed — script tag, iframe, standalone page |
| 5 | ✅ Done | Master admin panel — client management, per-shop AI model |
| 6 | 🔲 Next | WhatsApp / Messenger / Telegram + PWA |
| 7 | ✅ Done | Public API, Webhooks, Google Calendar, Subscription Lockout |
| 8 | ✅ Done | VPS Migration, SIP Telephony, Asterisk Bridge |

---

## Master Admin Access
- URL: `/admin-login`
- Auth: PIN-based (cookie session, NOT Supabase)
- Currently: `rajsyful@gmail.com`
- Features: view all clients, manage AI models, SIP IP config, knowledge extraction, backups

---

## Version
`apps/web/lib/version.ts` — bump `APP_VERSION` and `BUILD_NUMBER` before each deploy.
Current: **v1.0.0 build 105** (2026-06-09)
