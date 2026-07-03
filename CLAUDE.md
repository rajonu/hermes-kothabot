# KothaBot v2.0 — AI Handoff Document

> Last updated: 2026-06-18 | v1.0.0 · Build 179 | Maintained by Antigravity

---

## What Is This Project?

KothaBot is a **multi-tenant Voice AI SaaS platform** for Bangladeshi small businesses.  
Customers visit a merchant's website → click a floating phone widget → AI answers in Bangla/English.  
The AI takes orders, books appointments, answers questions — 24/7, no staff needed.

It also supports **SIP telephony** — businesses connect their IP phone number and incoming phone calls are automatically answered by the same AI assistant.

**Live URLs:**
- Dashboard: https://my.kothabot.ai.bd
- Landing page: https://kothabot.ai.bd
- Voice links: https://call.kothabot.ai.bd
- Admin: https://my.kothabot.ai.bd/admin-login (PIN protected)

---

## Repository & Deployment

```
GitHub:   https://github.com/rajonu/kothabot-2.0.git
Local:    /Users/rajrio/Desktop/dev/Claude-project/Kothabot-2.0/
```

### Production Deployment — Railway (web + voice) + VPS (SIP bridge)

| Service | Platform | Details |
|---|---|---|
| **Next.js web** | Railway | `https://my.kothabot.ai.bd` · auto-deploys from `main` |
| **Voice server** | Railway | `https://voice-server.up.railway.app` |
| **SIP bridge** | Contabo VPS | `163.128.144.171` · PM2 `kothabot-bridge` |

### VPS (SIP bridge only)

| Detail | Value |
|---|---|
| **IP** | `163.128.144.171` |
| **OS** | Ubuntu 22.04 LTS |
| **SSH** | `root` / `Allah7570#` |

**SSH command:**
```bash
sshpass -p 'Allah7570#' ssh -o StrictHostKeyChecking=no root@163.128.144.171
```

### VPS Services (PM2)

| PM2 Name | Script Path | Port | Description |
|---|---|---|---|
| `kothabot-bridge` | `/var/www/bridge/bridge.js` | `:9092` (TCP) | Asterisk ↔ Voice Server bridge |
| Asterisk PBX | `/etc/asterisk/` (systemd) | `:5060` (SIP) | SIP trunk registration & call routing |
| Nginx | `/etc/nginx/sites-available/kothabot` (systemd) | `:443` (SSL) | Reverse proxy + SSL termination |

> ⚠️ `kothabot-voice` PM2 process has been deleted from VPS — voice server runs on Railway. Nginx `/ws-voice` block cleaned. UFW firewall enabled.

### Deployment Workflow

```bash
# Web + voice server: just push to GitHub — Railway auto-deploys
git add -A && git commit -m "..." && git push origin main

# Bridge changes only (source in git at scratch/bridge.js, NOT auto-deployed):
sshpass -p 'Allah7570#' scp scratch/bridge.js root@163.128.144.171:/var/www/bridge/bridge.js
sshpass -p 'Allah7570#' ssh root@163.128.144.171 "pm2 restart kothabot-bridge"
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router, Server Components, TypeScript) |
| Auth & DB | Supabase (PostgreSQL + RLS + Storage) |
| Voice AI | Gemini 2.5/3.1 Flash Live via WebSocket |
| Text Chat | Gemini 2.5 Flash Lite (`/api/widget-chat`) |
| AI Extraction | Gemini 2.5 Flash Lite (`/api/training/extract-website`) |
| Voice Server | Node.js + `ws`, runs on Railway |
| Telephony | Asterisk PBX + custom Node.js bridge (`bridge.js`) on VPS |
| Styling | Tailwind v4, emerald green dark theme |
| Monorepo | Turborepo + pnpm |
| Deployment | Railway (web + voice) + Contabo VPS (SIP bridge) + Nginx + UFW |
| Push Notifications | `web-push` (VAPID), PWA service worker |
| Email | Resend SDK |
| DNS/CDN | Cloudflare |

---

## Full Architecture

```
  Browser ──HTTPS──► Railway: Next.js (my.kothabot.ai.bd)
                         └─ /ws-voice ──► Railway: Voice Server ──► Gemini Live API

  Phone ──SIP──────► VPS: Asterisk (:5060)
                         └─ AudioSocket ──► bridge.js (:9092) ──► Railway: Voice Server

  Next.js ──────────► Supabase (cloud)
  Browser (PWA) ─────► /api/push/* ──► web-push ──► Device notification
```

### Telephony Audio Flow (Phone Calls)
```
Phone → SIP Provider → Asterisk (8kHz G.711)
  → bridge.js (upscale 8kHz→24kHz, noise gate)
  → Voice Server (WS) → Gemini Live API (24kHz PCM)
  → response audio back: Gemini → Voice Server → bridge.js (downscale 24kHz→8kHz)
  → Asterisk → Phone
```

---

## Project Structure

```
Kothabot-2.0/
├── apps/
│   ├── web/                      ← Next.js app (ALL main code)
│   │   ├── app/
│   │   │   ├── (auth)/           ← login, register, onboarding
│   │   │   ├── (dashboard)/      ← client dashboard pages
│   │   │   ├── (admin)/          ← god admin panel
│   │   │   ├── (widget)/         ← embeddable voice widget
│   │   │   ├── (voice)/          ← public voice call pages
│   │   │   └── api/              ← all API routes
│   │   ├── components/           ← shared UI components
│   │   ├── lib/                  ← utilities, config, Supabase client
│   │   └── modules/              ← auth actions, etc.
│   └── voice-server/             ← WebSocket voice server
│       └── src/
│           ├── index.ts          ← WS server entry point
│           ├── sessions/
│           │   ├── manager.ts    ← Session lifecycle, chunking, timeouts
│           │   └── types.ts      ← SessionConfig type definitions
│           └── gemini/
│               └── client.ts     ← Gemini Live API connection, system prompt builder
├── scratch/
│   └── bridge.js                 ← Asterisk bridge source (tracked in git; SCP'd to VPS manually)
├── supabase/
│   └── migrations/               ← 001–019 SQL migrations
├── CLAUDE.md                     ← THIS FILE (ai-handbook)
├── HANDOFF.md                    ← Quick-start developer handoff
├── memory.md                     ← Detailed session memory
└── package.json
```

---

## Database Schema (Supabase)

All migrations in `/supabase/migrations/`. Run in order in Supabase SQL Editor.

| Migration | Description |
|---|---|
| 001_initial_schema.sql | shops, orders, customers, voice_sessions, training_data |
| 002_payment_system.sql | subscriptions, payments, platform_settings |
| 003_admin_audit_log.sql | admin_audit_log |
| 004_login_activity.sql | login_activity |
| 005_fix_subscriptions.sql | subscription fixes |
| 006_products.sql | products (JSONB metadata for all categories) |
| 007_orders_metadata.sql | orders metadata fields |
| 008_public_voice_links.sql | voice_links |
| 009_usage_limits.sql | usage limits system |
| 010_new_categories.sql | real_estate, education, creative_agency enum values |
| 011_knowledge_extraction.sql | knowledge_sources, knowledge_chunks |
| 012_backup_system.sql | backups, backup_logs |
| 013_api_keys.sql | api_keys, api_usage_logs, webhook_endpoints, webhook_deliveries |
| 014_calendar_integration.sql | calendar_integrations, calendar_events |
| 015_session_analytics.sql | voice_sessions: `end_reason`, `off_topic_count` |
| 016_transcript_retention.sql | voice_sessions: `order_linked`, `archived_at` + indexes |
| 017_performance_indexes.sql | indexes on orders, customers, voice_sessions, training_data, knowledge_chunks |
| 017_voice_session_source.sql | voice_sessions: `source`, `caller_did` fields |
| 018_leads.sql | leads table for lead capture gate |
| 018_products_sku_index.sql | unique SKU index on products |
| **019_push_subscriptions.sql** | push_subscriptions table for PWA push ← **run this** |

> ⚠️ Migration 019 must be run in Supabase SQL Editor before push notifications work.

---

## Environment Variables

### Railway: web service (set via `railway variables set`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://jrlfbfejeccsixnxhuwo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_APP_URL=https://my.kothabot.ai.bd
NEXT_PUBLIC_VOICE_SERVER_URL=wss://voice-server.up.railway.app/ws-voice
GEMINI_API_KEY=<key>
NEXT_PUBLIC_GEMINI_API_KEY=<key>
BACKUP_CRON_SECRET=<set>
TRANSCRIPT_CLEANUP_SECRET=<set>
GATEWAY_TOKEN=<set>
GOOGLE_CALENDAR_CLIENT_ID=<id>
GOOGLE_CALENDAR_CLIENT_SECRET=<secret>
ADMIN_PIN=<pin>
# PWA Push Notifications (build 159+)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid public key — see Railway>
VAPID_PUBLIC_KEY=<same as above>
VAPID_PRIVATE_KEY=<vapid private key — see Railway>
VAPID_SUBJECT=mailto:support@kothabot.ai.bd
INTERNAL_API_SECRET=<random hex — see Railway>
```

### Railway: voice server
```bash
GEMINI_API_KEY=<key>
PORT=8080
ALLOWED_ORIGINS=https://my.kothabot.ai.bd
```

### VPS: `/var/www/bridge/.env`
```bash
KOTHABOT_WSS_URL=wss://voice-server.up.railway.app/ws-voice
KOTHABOT_WEB_URL=https://my.kothabot.ai.bd
GATEWAY_TOKEN=<set>
```

> ⚠️ Bridge now points to Railway URLs — voice server moved from VPS to Railway.

---

## Key Architecture Patterns

### 1. Category-Aware UI
Everything adapts to the shop's business category (clinic, restaurant, salon, etc.).
- Labels: `lib/category-nav.ts` → `getCategoryNav(category)`
- Product config: `app/(dashboard)/products/page.tsx` → `CATEGORY_CONFIG`
- AI prompts: `lib/prompt-layers.ts` → `DEFAULT_CATEGORY_PROMPTS`
- Categories: `lib/categories.config.ts` → `CATEGORIES_CONFIG`

**11 supported categories:** clinic, salon, services, restaurant, retail, pharmacy, real_estate, education, creative_agency, grocery, other

#### Clinic product_type split (3 types in `products` table)
- `product_type='doctor'` → Scheduling tab only. Shows in AI KB "Doctors" section.
- `product_type='service'` → Scheduling tab only. Shows in AI KB "Appointment Types" section.
- `product_type='test'` → Tests & Diagnostics page. Shows in AI KB "Diagnostic Tests" section.

The nav badge for clinic counts **only** `product_type='test'` (not doctors/services). `layout.tsx` applies a JSONB filter for this when `category === 'clinic'`.

### 1b. Voice Greeting Language Rule (CRITICAL)
`gemini/client.ts` `onopen` sends a trigger to make the AI speak first. The trigger is **language-aware**:
- `language='en'` → `"Greet the customer warmly in English"` — does NOT pass stored `greetingMessage` which may be in Bangla
- `language='bn'` → `"Say: '${greetingMessage}'"` using stored Bangla text (or Bangla default)
- `language='auto'` → `"Say: '${greetingMessage}'"` using stored text (or English default)

**Why:** INTL shops often have `greetingMessage` saved in Bangla from setup. Passing literal Bangla text to Gemini overrides even a STRICT English rule. Always generate language-appropriate greeting triggers.

### 2. 4-Layer AI Prompt System
```
Layer 1: Global Rules (platform safety/behavior)
Layer 2: Business Profile (shop name, language, custom prompt)
Layer 3: Category Rules (order/booking collection instructions)
Layer 4: Knowledge Base (training data + products + knowledge chunks)
```
Knowledge chunks (website extraction) load first — highest priority.

### 3. Auth Flow
- **Email/password** → standard Supabase auth
- **Google OAuth** → Supabase provider → `/auth/callback` route exchanges code → `/dashboard`
- **Magic link (admin)** → `/api/admin/generate-access-link` → redirects to `/login#access_token=...` → `setSession` in useEffect
- **Admin PIN** → cookie-based, separate from Supabase user auth

### 4. SIP Telephony Bridge
- **bridge.js** is a standalone Node.js script (source tracked in git at `scratch/bridge.js`, but NOT part of the monorepo build pipeline — deployed manually via SCP)
- Receives raw 8kHz G.711 audio from Asterisk via TCP AudioSocket
- Upscales to 24kHz PCM, applies noise gate, sends to Voice Server via WebSocket
- Receives AI audio from Voice Server, downscales to 8kHz, sends back to Asterisk
- Fetches shop config from Web API every 5 minutes (auto-cache refresh)
- DID matching strips leading zeros for normalization
- Config API endpoint: `GET /api/voice/telephony-sync` (Bearer token auth)

---

## Important Files

### Auth
- `app/(auth)/login/page.tsx` — login page, Google button, hash token handler
- `app/(auth)/register/page.tsx` — register page, Google button
- `app/auth/callback/route.ts` — OAuth callback, exchanges code → `/dashboard`
- `lib/admin-session.ts` — admin PIN session helpers

### Dashboard
- `app/(dashboard)/layout.tsx` — parallel nav counts; clinic uses JSONB filter for test-only badge; `category` must be declared BEFORE `Promise.all`
- `app/(dashboard)/dashboard/page.tsx` — dashboard home page
- `app/(dashboard)/analytics/page.tsx` — call analytics + AI Cost Protection card
- `app/(dashboard)/products/page.tsx` — category-aware product/service manager (clinic = Tests & Diagnostics)
- `app/(dashboard)/orders/[id]/page.tsx` — order detail with AI transcript viewer
- `app/(dashboard)/customers/page.tsx` — category-aware customers/patients list
- `app/(dashboard)/training/page.tsx` — AI Knowledge Base page
- `app/(dashboard)/integrations/TelephonyPanel.tsx` — IP Phone Connection panel
- `app/(dashboard)/integrations/GoogleCalendarPanel.tsx` — shows sync error banner when last_error present
- **`app/(dashboard)/transcripts/page.tsx`** — voice call transcript viewer + list
- **`app/(dashboard)/scheduling/`** — clinic-only: Locations, Doctors, Services, Schedules, Off Days, Embed tabs

### Voice Server (Key Files)
- `apps/voice-server/src/index.ts` — WebSocket server entry, route handling
- `apps/voice-server/src/sessions/manager.ts` — Session lifecycle, chunking (90s), inactivity (40s), off-topic detection, farewell detection
- `apps/voice-server/src/gemini/client.ts` — Gemini Live API connection, `buildSystemInstruction()`, `startLiveSession()`, `summarizeTranscript()`

### Telephony (VPS Only, Not in Git)
- `/var/www/bridge/bridge.js` — Asterisk ↔ Voice Server bridge (local copy: `scratch/bridge.js`)
- `/etc/asterisk/pjsip.conf` — SIP trunk registrations (2 trunks configured)
- `/etc/asterisk/extensions.conf` — Dialplan routing all calls to AudioSocket
- `/etc/nginx/sites-available/kothabot` — Nginx reverse proxy config
- `/etc/nginx/conf.d/proxy.conf` — Buffer size overrides for large auth headers

### API Routes — Voice & Transcripts
- `api/voice/telephony-sync/route.ts` — returns all shop configs for bridge (Bearer auth)
- `api/voice/system-config/route.ts` — returns SIP IPs for dynamic Asterisk config
- `api/voice/save-session/route.ts` — save session + extract order
- `api/voice/check-limit/route.ts` — usage check + return plan-based duration cap
- `api/voice/transcripts/route.ts` — list all transcripts
- `api/voice/cleanup-transcripts/route.ts` — auto-delete expired non-order transcripts

### API Routes — Clinic Scheduling & Booking
- `api/scheduling/locations/route.ts` + `[id]/route.ts` — location CRUD (clinic only)
- `api/scheduling/products/route.ts` — doctor/service CRUD (sets `product_type` in metadata)
- `api/scheduling/schedules/route.ts` — working hours CRUD (delete by `id`)
- `api/scheduling/links/route.ts` — doctor→location and doctor→service matrix (POST + DELETE, `type: 'doctor_location'|'doctor_service'`)
- `api/scheduling/special-days/route.ts` — off days and holidays
- `api/book/[shopId]/route.ts` — public booking submission (no auth, CORS)
- `api/book/[shopId]/options/route.ts` — cascading select: locations → doctors → services
- `api/book/[shopId]/available-dates/route.ts` — available days in a month for calendar
- `api/book/[shopId]/availability/route.ts` — time slots for a specific date
- `lib/booking.ts` — `getAvailableSlots()` + `createBooking()` — single source of truth

### API Routes — Backup & Integrations
- `api/backup/create/route.ts` — create client backup
- `api/backup/cron/route.ts` — scheduled backup endpoint
- `api/api-keys/route.ts` — dashboard: list/generate API keys (max 4 active)
- `api/calendar/{connect,callback,status,disconnect,test,settings}` — Google Calendar OAuth + CRUD
- `api/push/{subscribe,unsubscribe,send}` — PWA push subscription management + internal sender
- `api/notifications/count` — live count for bell (pending orders + unread support)
- `lib/push.ts` — `sendPushNotification()` server-side helper

### Public API v1 (Bearer token authenticated)
- `api/v1/me` — shop info
- `api/v1/customers` + `[id]` — CRUD customers
- `api/v1/orders` + `[id]` — CRUD orders
- `api/v1/appointments` + `[id]` — CRUD appointments
- `api/v1/products` + `[id]` — list (GET) + **upsert by SKU (POST, single or `{products:[…]}` bulk)** + PUT/DELETE. Used by the WordPress plugin to push WooCommerce products.
- `api/v1/knowledge` — **PUT/DELETE** WordPress knowledge chunk (API-key authed). Stored as `knowledge_chunks.source_type='wordpress'`, surfaced by `buildTrainingData()`.
- `api/v1/ai/chat` — AI chat with full 4-layer context
- `api/v1/ai/order` — AI extract + save order from free text
- `api/v1/webhooks` + `[id]` — manage webhook subscriptions

> Voice/chat-created orders now fire `order.created` / `appointment.created` webhooks (added in `voice/save-session` + `widget-chat`), so external systems (WooCommerce/Amelia) can sync.

### WordPress Integration — KothaBot Connect plugin (`wordpress-plugin/kothabot-connect/`)
PHP plugin that connects a WP site to a shop's KothaBot account. Phase 1: settings page (API key validated via `/api/v1/me`), WooCommerce product sync (upsert by SKU, real-time + batched WP-Cron full sync), WC order → KothaBot, page-knowledge sync → `PUT /api/v1/knowledge`, widget embed via `embed.js`. Phase 2: signed webhook receiver at `/wp-json/kothabot/v1/webhook` (HMAC `X-KothaBot-Signature`) creating WC orders + Amelia bookings from voice/chat events, and Amelia → KothaBot booking sync. Loop prevention via origin tags (`_kothabot_origin`, `metadata.wc_order_id`/`amelia_id`). **Not deployed to WP yet — needs install + a live API key.** Amelia *outbound* booking-create is best-effort (Amelia version-dependent); use the `kothabot_create_amelia_booking` filter to customize.

### Admin
- `app/(admin)/admin/page.tsx` — admin dashboard + nav
- `app/(admin)/admin/shops/[shopId]/` — per-shop management
- `app/(admin)/admin/settings/` — SIP IP config, global AI rules, category prompts
- `api/admin/settings/sip-ips/route.ts` — manage SIP provider IPs (bridge auto-syncs)

---

## Features Built (All Versions)

### ✅ Core Platform (builds 1–79)
- Multi-tenant dashboard with 11 business categories
- Google OAuth + email/password auth
- Product/service CRUD with category-aware fields
- Order management with AI-extracted orders
- Customer/patient management
- AI Knowledge Base (manual + website extraction)
- Voice AI widget (Gemini Live, session chunking)
- Text chat widget (Gemini Flash Lite)
- Public API v1 with Bearer auth, rate limiting, webhooks
- Backup & restore system
- Google Calendar integration
- Email notifications (Resend)
- Master admin panel

### ✅ Voice Cost / Abuse Protection (build 94)
- Off-topic 3-strike system
- Plan-based duration caps (Trial=3min, Starter=5min, Pro=8min, Business=12min)
- 40-second silence timeout
- Session analytics with end_reason tracking

### ✅ Transcript Retention (build 95)
- Order-linked transcripts kept permanently
- Non-order transcripts auto-deleted after 7 days
- Dashboard transcript viewer with modal

### ✅ Subscription Lockout (build 104)
- Unpaid paid-tier accounts locked to billing page
- Widget padlock screen for unpaid merchants
- API/voice call blocking for past_due subscriptions

### ✅ VPS Migration & SIP Telephony (build 105)
- Nginx reverse proxy with SSL (Let's Encrypt) on VPS
- Asterisk PBX with 2 SIP trunks registered
- bridge.js: audio resampling, noise gate, DID matching
- IP Phone Connection UI panel (redesigned)
- 9-second call startup (Gemini initialization baseline)
- Note: web + voice server later moved BACK to Railway; only SIP bridge stays on VPS

### ✅ QC Audit + Security (builds 150–156)
- Fixed region fallback bug (DEV/undefined → INTL)
- Webhook echo loop prevention (`_kothabot_origin` guard)
- Cron routes use `X-Cron-Secret` header
- INTL shops: language defaults to English, greeting defaults to English
- 6 email routes patched (were publicly callable without auth)
- Admin session cookie lifetime fixed (now 30 days, not 120 min)
- Custom 404 page
- Category-aware labels sitewide (11 files — all hardcoded strings use catNav)

### ✅ Notification Bell + PWA Push (builds 158–160)
- `/api/notifications/count` — live count endpoint (pending orders + unread support)
- Topbar + BottomNav poll every 30s — bell updates without page refresh
- PWA push notifications: `web-push` VAPID, `push_subscriptions` DB table (migration 019)
- Service worker push + notificationclick listeners
- `PushNotificationToggle` in Settings page
- Triggers: new order (voice/chat/API), admin support reply

### ✅ Clinic / Healthcare Scheduling Engine (builds 174–179)
- Full clinic-only scheduling system: Locations, Doctors, Services, Schedules, Off Days, Embed
- `clinic_schedules`, `clinic_locations`, `clinic_doctor_services`, `clinic_doctor_locations` tables
- Products table re-used with `product_type` field: `doctor` / `service` / `test`
- Public booking widget at `/book/[shopId]` — 6-step wizard, no auth required, CORS
- All slot math in `lib/booking.ts` — `getAvailableSlots()` + `createBooking()` (double-booking prevention via unique index)
- AI is schedule-aware: `widget-training.ts` builds "Doctor Working Hours" section; both voice + text chat prompts reference it
- Voice AI language fix: greeting trigger is language-aware (English account won't greet in Bangla)
- Google Calendar patient name fix + sync error banner

---

## ⚠️ Two Auth Systems (CRITICAL gotcha)
KothaBot has **two separate auth systems** — do not mix them:
1. **Supabase user auth** — for clients (shop owners). Use `createClient()` + `supabase.auth.getUser()`.
2. **Admin PIN session** — for the god admin panel (`/admin/*`). Cookie-based, NO Supabase user. Use `requireAdminSession()` in API routes.

**The god admin is NOT a Supabase user.** Any admin API route that calls `supabase.auth.getUser()` + `isAdmin()` will FAIL. Always use `requireAdminSession()` for admin routes.

---

## Nginx Configuration (VPS)

**Main site:** `/etc/nginx/sites-available/kothabot`
```nginx
server {
    server_name my.kothabot.ai.bd;

    location /ws-voice {
        proxy_read_timeout 86400;
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/my.kothabot.ai.bd/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my.kothabot.ai.bd/privkey.pem;
}
```

**Buffer fix:** `/etc/nginx/conf.d/proxy.conf`
```nginx
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

---

## Asterisk SIP Configuration (VPS)

### Registered Trunks
| Trunk | DID | SIP Host | Transport | Credentials |
|---|---|---|---|---|
| trunk1 ⚠️ deprecated | `09617854561` | `202.40.176.2` | TCP | `09617854561` / `Automas@KB61` |
| **trunk2 (ACTIVE)** | `09644840050` | `123.0.31.250` | UDP | `09644840050` / (in pjsip.conf) |

> ⚠️ Only `09644840050` (Alliance Dental, trunk2) is in active use. `09617854561` (trunk1) is still registered with the provider but not in use by any shop — do NOT remove the trunk config without coordinating with the SIP provider.

### Dialplan (`/etc/asterisk/extensions.conf`)
```ini
[kothabot-incoming]
exten => _X.,1,NoOp(Incoming call for DID: ${EXTEN})
same => n,Ringing()
same => n,Wait(1)
same => n,Answer()
same => n,Set(PAD=00000000000000000000000000000000)
same => n,Set(EXT_LEN=${LEN(${EXTEN})})
same => n,Set(PAD_LEN=$[32 - ${EXT_LEN}])
same => n,Set(UUID_STR=${PAD:0:${PAD_LEN}}${EXTEN})
same => n,Set(DID_UUID=${UUID_STR:0:8}-${UUID_STR:8:4}-${UUID_STR:12:4}-${UUID_STR:16:4}-${UUID_STR:20:12})
same => n,Audiosocket(${DID_UUID},127.0.0.1:9092)
same => n,Hangup()
```

### Useful Asterisk Commands
```bash
asterisk -rx 'pjsip show registrations'   # check trunk registration status
asterisk -rx 'core reload'                 # reload config after changes
asterisk -rx 'pjsip show endpoints'        # show endpoints
```

---

## Pending / Known Issues

### ✅ Push Notifications Pending Migration
Run `supabase/migrations/019_push_subscriptions.sql` in Supabase SQL Editor to activate push.

### 🟡 Bridge Manual SCP Deploy
`bridge.js` source IS tracked in git at `scratch/bridge.js`, but the VPS copy at `/var/www/bridge/bridge.js` is NOT auto-deployed by `git pull`. Changes must be manually SCP'd then `pm2 restart kothabot-bridge`.

### ✅ Bridge Docker Error (Fixed, build 106)
The bridge previously ran `docker exec asterisk-server asterisk -rx 'core reload'` when SIP IPs changed, but Asterisk runs natively (not in Docker), producing a harmless error in logs. Fixed in `scratch/bridge.js` to call `asterisk -rx 'core reload'` directly.

### 🟡 Call Startup Latency (9 seconds)
The Gemini Live API takes ~5-7 seconds to initialize a new session and generate the first audio greeting. Combined with Asterisk's `Wait(1)` and SIP routing, total startup is ~9 seconds. This is the baseline and cannot be reduced without shortening the knowledge base.

### 🟡 Google Calendar OAuth Verification
Until Google verifies the OAuth app, add yourself as a **Test User** in Google Cloud Console → OAuth consent screen.

### 🟡 Phase 6 Webhooks (not started)
- WhatsApp webhook (`/api/webhooks/whatsapp`)
- Messenger webhook (`/api/webhooks/messenger`)
- Telegram webhook (`/api/webhooks/telegram`)
- Google Sheets integration

### ✅ UFW Firewall Enabled (build 156)
VPS UFW is active. Open ports: 22, 80, 443, 5060/tcp+udp, 9092/tcp, 10000-20000/udp.

---

## 🔍 Performance Audit (2026-06-10) — Prioritized Refactor Backlog

Full architecture/perf audit completed (see `memory.md` § "Performance Audit — 2026-06-10" for details + SQL). **Fix pass applied 2026-06-10** (restore point: git tag `thanks`). Status:

| # | Issue | Status |
|---|---|---|
| 1 | **No indexes** on `orders`, `customers`, `voice_sessions`, `training_data`, `knowledge_chunks` | ✅ FIXED — `supabase/migrations/017_performance_indexes.sql` created. **⚠️ Run it in Supabase SQL Editor.** |
| 2 | **Dashboard layout did ~11 Supabase round-trips per navigation** + embedded full trainingData into VoiceWidget HTML | ✅ FIXED — layout now does 3 query waves (user → shop → 6 parallel counts/sub). TrainingData lazy-loads via new `GET /api/voice/widget-context` when the widget's call button is pressed (cached in-component). Shared builder: `lib/widget-training.ts`. |
| 3 | `/api/voice/telephony-sync` fetched **all shops**, filtered in JS | ✅ FIXED — SQL-side JSONB filter (`ai_config->telephony->>status = 'active'`). ⚠️ Hardcoded token fallback KEPT (bridge on VPS uses the same default); set `GATEWAY_TOKEN` on web `.env.local` + bridge `.env`, then remove the fallback. Logs a warning until then. |
| 4 | 74× `select('*')` over-fetching | 🔶 PARTIAL — dashboard layout now selects explicit shop columns. Remaining `select('*')` sites + revenue DB-aggregate (needs PostgREST aggregate flag) still open. |
| 5 | 257 KB `favicon.png` + 257 KB `kotha-logo.png` | ✅ FIXED — resized to 64px (7 KB) / 192px (47 KB). |
| 6 | `images.remotePatterns: hostname '**'` open image proxy | ✅ FIXED — restricted to Supabase storage host (avatars are base64 data URLs; QR images use `unoptimized`). |
| 7 | In-memory rate limiter breaks if PM2 runs >1 instance | 🟡 OPEN — keep `kothabot-web` single-instance, or move to Redis. |
| 8 | Webhook delivery fire-and-forget, no retry | 🟡 OPEN — add retry cron over failed `webhook_deliveries`. |

Already good: parallel query batching, immutable static-chunk caching, `optimizePackageImports`, hashed+indexed API keys, bridge localhost networking, voice-session cost protection.

---

## 🔍 Performance Audit (2026-06-18) — Second Pass

Re-audit after clinic scheduling shipped. Architecture is healthy; the one real hot-path waste was the per-message KB rebuild. Findings:

| # | Issue | Status |
|---|---|---|
| A | **`buildTrainingData` rebuilt on EVERY widget-chat message** (3–5 DB queries × N messages per conversation) + every widget-context fetch | ✅ FIXED — added 60s in-process cache keyed by `shopId` in `lib/widget-training.ts`. Original builder renamed `buildTrainingDataUncached`; cached wrapper keeps the same name so all call sites are unchanged. `invalidateTrainingData(shopId)` exported for immediate refresh after KB edits. Same single-instance caveat as the rate limiter. |
| B | Clinic booking slot math (`lib/booking.ts getAvailableSlots`) | ✅ ALREADY GOOD — indexes `idx_orders_appt_range (shop_id, doctor_id, starts_at, ends_at)` + `uniq_doctor_slot` cover it; slots are computed in-memory, not stored. No change needed. |
| C | `select('*')` count grew to **89** (mostly v1 API single-row reads + scheduling CRUD) | 🔶 PARTIAL — hottest list/layout paths already use explicit columns. Remaining are single-row reads where over-fetch cost is negligible. Tighten opportunistically, not a priority. |
| D | In-memory rate limiter + new KB cache both assume single web instance | 🟡 OPEN — **keep `kothabot-web`/Railway web at 1 instance**, or move both to Redis. Documented so nobody scales horizontally without addressing it. |
| E | Webhook delivery still fire-and-forget, no retry (`lib/webhook-delivery.ts`) | 🟡 OPEN — add a retry cron over failed `webhook_deliveries` (carried from 2026-06-10 #8). |
| F | `GATEWAY_TOKEN` insecure default still in `api/voice/telephony-sync` | 🟡 OPEN — set the env var on web + bridge, then remove the fallback (carried from 2026-06-10 #3). |

**Verdict:** no large refactor warranted. Codebase already batches queries, indexes the hot tables, lazy-loads training data, and caps voice costs. The KB cache (A) was the single high-value fix; everything else is documented backlog, not urgent.

---

## Admin Access

- URL: https://my.kothabot.ai.bd/admin-login
- Auth: PIN-based (separate from Supabase)
- Nav: Shops | Payments | Support | Emails | Knowledge | Backups | Settings | Audit

---

## Common Gotchas

1. **Deployment** — push to `main` and Railway auto-deploys web + voice. VPS only needs manual update for bridge changes (SCP).
2. **Bridge changes** — Source IS in git at `scratch/bridge.js`, but the VPS copy at `/var/www/bridge/bridge.js` is NOT auto-deployed by `git pull`. SCP it manually after editing.
3. **Middleware file** — Next.js 16 uses `proxy.ts` (not `middleware.ts`). Having both crashes the compiler.
4. **Two auth systems** — Supabase user auth (clients) vs Admin PIN session (god admin). Never mix.
5. **Admin pages** — do NOT add `requireAdminSession()` to page components; the `(admin)/layout.tsx` handles auth. Only use it in API routes.
6. **NEXT_PUBLIC_ vars** — baked at build time. Must be set BEFORE `pnpm run build`.
7. **Voice server is separate** — run `npm run build` in `apps/voice-server/` separately if modified.
8. **DID matching** — bridge strips leading zeros. `09644840050` matches `9644840050`.
9. **Nginx buffers** — if you see 502 errors after auth, check `/etc/nginx/conf.d/proxy.conf` buffer sizes.
10. **Asterisk reload** — after changing `/etc/asterisk/pjsip.conf`, run `asterisk -rx 'core reload'`.
11. **Clinic nav badge** — `layout.tsx` must declare `const category` BEFORE the `Promise.all` block. Putting it after causes ReferenceError (temporal dead zone). Badge uses JSONB filter `.eq('metadata->>product_type', 'test')` for clinic.
12. **Voice greeting language** — do NOT pass a stored `greetingMessage` directly in the trigger when `language='en'`. The stored greeting may be in Bangla and will override the STRICT English rule. See `gemini/client.ts` `onopen` handler.
13. **Clinic scheduling cascade** — when deleting a doctor, also delete their `clinic_schedules` rows or you get orphaned "—" entries in the Schedules tab. `removeDoctor()` in `SchedulingSettings.tsx` handles this.
14. **Booking widget header** — `/book/[shopId]/page.tsx` has no header (removed). The wizard fills full width (`max-w-2xl`). Don't re-add the shop name/title — it was intentionally removed.
