# Project Overview

## What Is KothaBot?

KothaBot is a **multi-tenant Voice AI SaaS platform** targeting Bangladeshi and international small businesses. A merchant embeds a floating phone widget on their website. When a visitor clicks it, an AI assistant responds in real-time voice — taking orders, booking appointments, answering questions — 24/7, no human staff required.

The same AI voice is also reachable by phone call via SIP telephony (Asterisk PBX), allowing customers to call the business's real phone number and be answered by the AI.

---

## Architecture Overview

```
                    ┌──────────────────────────────────────┐
                    │         Contabo VPS (163.128.144.171) │
                    │                                      │
  Browser ──HTTPS──►│  Nginx (:443)                        │
                    │    ├─ / ──► Next.js (:3000)          │
                    │    └─ /ws-voice ──► Voice Server (:8080) ──► Gemini Live API
                    │                                      │
  Phone ──SIP──────►│  Asterisk (:5060)                    │
                    │    └─ AudioSocket ──► bridge.js (:9092) ──► Voice Server (:8080)
                    │                                      │
                    │  Next.js ──► Supabase (cloud)        │
                    └──────────────────────────────────────┘
```

---

## Deployment Topology

### Contabo VPS (Primary — Bangladesh)

| PM2 Process | Port | Role |
|---|---|---|
| `kothabot-web` | :3000 | Next.js dashboard + all API routes |
| `kothabot-voice` | :8080 | WebSocket voice server |
| `kothabot-bridge` | :9092 TCP | Asterisk ↔ Voice Server audio bridge |
| Asterisk PBX (systemd) | :5060 SIP | SIP trunk registration + call routing |
| Nginx (systemd) | :443 SSL | Reverse proxy + SSL termination |

**URL:** https://my.kothabot.ai.bd

### Railway (INTL staging / secondary)

| Service | Role |
|---|---|
| `web` | Next.js (kothabot-web) |
| `enthusiastic-amazement` | Voice Server (kothabot-voice) |

**URL:** https://web-production-64818.up.railway.app  
**Project:** soothing-hope

### Supabase (Cloud)

- **Project:** jrlfbfejeccsixnxhuwo.supabase.co
- Shared by both VPS and Railway deployments
- PostgreSQL + Row Level Security + Storage

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router, Server Components, TypeScript) |
| Auth & DB | Supabase (PostgreSQL + RLS + Storage) |
| Voice AI | Gemini 2.5 Flash Live via WebSocket |
| Text Chat | Gemini 2.5 Flash Lite (`/api/widget-chat`) |
| AI Extraction | Gemini 2.5 Flash Lite (`/api/training/extract-website`) |
| Voice Server | Node.js + `ws` |
| Telephony | Asterisk PBX + custom bridge.js |
| Styling | Tailwind v4, emerald green dark theme |
| Monorepo | Turborepo + pnpm |
| Deployment | Contabo VPS + Nginx + Let's Encrypt + PM2 |
| Email | Resend SDK |
| DNS/CDN | Cloudflare |
| Payments (BD) | bKash, Nagad, Rocket (manual/QR) |
| Payments (INTL) | Paddle (external checkout URL) |

---

## Monorepo Structure

```
Kothabot-2.0/
├── apps/
│   ├── web/                  ← Next.js app (main codebase)
│   └── voice-server/         ← WebSocket voice server
├── scratch/
│   └── bridge.js             ← Asterisk bridge (tracked here; deployed via SCP)
├── supabase/
│   └── migrations/           ← 001–018 SQL migrations
├── wordpress-plugin/
│   └── kothabot-connect/     ← WP plugin source
├── docs/
│   └── architecture/         ← This documentation
├── CLAUDE.md                 ← AI handoff document
└── HANDOFF.md                ← Quick-start developer guide
```

---

## Data Flow

### Voice Call (Widget)
```
Browser → Nginx → Next.js serves widget iframe
Widget iframe → WebSocket /ws-voice → Nginx → Voice Server (:8080)
Voice Server ↔ Gemini Live API (bidirectional audio stream)
Voice Server → POST /api/voice/save-session (order extraction, transcript)
```

### Voice Call (Phone / SIP)
```
Phone → SIP Provider → Asterisk (:5060)
Asterisk → AudioSocket → bridge.js (:9092 TCP)
bridge.js (8kHz→24kHz resample, noise gate) → Voice Server (:8080) WebSocket
Voice Server ↔ Gemini Live API
Response audio → bridge.js (24kHz→8kHz resample) → Asterisk → Phone
```

### Text Chat (Widget)
```
Browser → POST /api/widget-chat
Next.js → Gemini 2.5 Flash Lite (non-streaming → streaming SSE)
Response streamed back to widget
```

---

## Security Model

### Two Auth Systems (Never Mix)

1. **Supabase Auth** — shop owners (clients). Every dashboard page/API uses `createClient()` + `supabase.auth.getUser()`.
2. **Admin PIN Session** — god admin panel (`/admin/*`). Cookie-based, NO Supabase user. Use `requireAdminSession()` in admin API routes.

### RLS (Row Level Security)
All Supabase tables enforce RLS. Clients can only read/write their own shop's data. Service role key (server-side only) bypasses RLS for admin operations.

### Feature Flags (Per Shop)
Stored in `shops.ai_config` (JSONB):
- `voip_enabled` — VoIP telephony panel visible (default: false)
- `api_access_enabled` — API Access panel visible (default: false)
- `white_label` — AI hides KothaBot branding (default: false)

Set by god admin only via `/api/admin/set-shop-feature`.

---

## Environment Variables

### Web App (`apps/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL              # https://my.kothabot.ai.bd
NEXT_PUBLIC_VOICE_SERVER_URL     # wss://my.kothabot.ai.bd/ws-voice
NEXT_PUBLIC_VOICE_LINK_URL       # https://call.kothabot.ai.bd
GEMINI_API_KEY
NEXT_PUBLIC_GEMINI_API_KEY
BACKUP_CRON_SECRET
TRANSCRIPT_CLEANUP_SECRET
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
ADMIN_PIN
ADMIN_SESSION_SECRET
GATEWAY_TOKEN                    # auth for /api/voice/telephony-sync
```

### Voice Server (`apps/voice-server/.env`)
```
GEMINI_API_KEY
PORT=8080
ALLOWED_ORIGINS=https://my.kothabot.ai.bd
```

### Bridge (`/var/www/bridge/.env` on VPS)
```
KOTHABOT_WSS_URL=ws://127.0.0.1:8080/ws-voice
KOTHABOT_WEB_URL=http://127.0.0.1:3000
```
> Bridge connects via localhost to eliminate network latency.
