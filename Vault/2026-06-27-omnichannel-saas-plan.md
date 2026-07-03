# Plan: Omnichannel SaaS Upgrade — Facebook Messenger + WhatsApp (Baileys) + Live Chat with Human Takeover

> Date: 2026-06-27

## Prerequisites — before starting Messenger/WhatsApp implementation
1. **New login required**: a fresh Meta for Developers account (separate from any personal FB) to create
   the Facebook App + Page for Messenger, and to register the WhatsApp Business number. Get this set up
   first — webhook verification and OAuth steps below depend on it.
2. **Stage a local dev server on the Mac** to build/test `apps/bot-server` (Baileys + FB webhook handling)
   before touching Railway: run it locally, tunnel webhooks with a tool like `ngrok`/`cloudflared` so Meta
   can reach the local server during setup/testing, then promote to Railway once verified.

## Context

KothaBot is a multi-tenant Voice/Text AI SaaS for Bangladeshi businesses. Today it answers via a
website voice widget, a text chat widget, SIP phone calls, and a public API — all driven by the same
4-layer Gemini prompt + order/appointment extraction pipeline. The owner wants to reach customers
where they already are: **Facebook Messenger** and **WhatsApp**, plus a **live-chat dashboard** where
a human can take over from the AI (both via a dashboard toggle and automatically when the owner replies
from their own phone). Goal: add these three features as new channels that **reuse the existing AI
inference, knowledge base, order extraction, and webhook logic** — keeping every current function intact.

### Reality check that shaped this plan (differs from the original spec)
- **No Express / no Socket.io exist.** Web is **Next.js 16 App Router**; long-lived sockets run in a
  separate **raw-`ws` voice-server** on Railway. Dashboard "realtime" is 30s polling.
- Tenant table is **`shops`** (PK `id`, owner via `owner_id = auth.uid()`), FK column is **`shop_id`** —
  not `users`/`client_id`. All new tables use `shop_id`.
- AI inference is **not yet factored out** — `widget-chat`, `v1/ai/chat`, and `voice/save-session` each
  re-assemble the prompt. We extract one shared helper and reuse it for the new channels.

### Decisions (confirmed with user)
1. **New `apps/bot-server`** Railway service hosts Baileys (WhatsApp) + Facebook webhook processing +
   the routing engine. Kept separate from voice-server (whose hard session caps would fight WhatsApp's
   permanent connections).
2. **Supabase Realtime** is the dashboard transport (browser subscribes to Postgres changes; QR + alerts
   via realtime broadcast). No Socket.io.
3. **Encrypt tokens at rest** with AES-256-GCM (`wa_session_data`, `fb_page_access_token`).
4. **One phased PR** on branch `claude/saas-facebook-whatsapp-livechat-p9nbwc`, organized in clear commits.

---

## Architecture overview

```
Facebook ──webhook POST──► Next.js /api/webhooks/facebook ──┐
                                                            ├─► Routing Engine (shared lib) ─► AI core ─► reply out
WhatsApp ──Baileys socket─► apps/bot-server ────────────────┘        │
                                                                     ▼
Owner phone (fromMe) ─► Baileys messages.upsert ─► takeover detector ─► conversations.is_ai_paused=true
                                                                     │
Dashboard ◄── Supabase Realtime (conversations + messages rows) ◄────┘
Dashboard ──pause/resume──► Next.js /api/livechat/* ──► conversations.is_ai_paused toggle
```

- **Outbound to Messenger**: Graph API call from Next.js or bot-server (page token).
- **Outbound to WhatsApp**: must go through the live Baileys socket → only `apps/bot-server` can send.
- **Why bot-server owns WhatsApp send/receive**: the socket object lives in that process's memory.
  Next.js routes that need to send WhatsApp call an internal endpoint on bot-server (shared secret).

---

## STEP 1 — Database migrations (`supabase/migrations/`)

Next free number is **020** (019 is the highest). Follow existing conventions exactly: `gen_random_uuid()`
PKs, `shop_id UUID REFERENCES shops(id) ON DELETE CASCADE`, `CREATE TYPE … AS ENUM`, RLS enabled with
`shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())`. Adapt the spec's `client_id`→`shop_id`.

- **`020_omnichannel.sql`**
  - `CREATE TYPE channel_type AS ENUM ('facebook','whatsapp');`
  - **`clients_channels`** — one row per (shop, channel): `id`, `shop_id`, `channel_type`, `fb_page_id`,
    `fb_page_access_token TEXT` (encrypted), `fb_page_name`, `wa_session_data JSONB` (encrypted Baileys
    creds), `wa_phone`, `is_active BOOLEAN DEFAULT true`, `connected_at`, `last_error`, timestamps.
    Unique `(shop_id, channel_type)`.
  - **`conversations`** — `id`, `shop_id`, `platform channel_type`, `customer_external_id` (PSID/JID),
    `customer_name`, `is_ai_paused BOOLEAN DEFAULT false`, `paused_at TIMESTAMPTZ`, `pause_reason TEXT`
    (`'dashboard'|'phone'|null`), `last_message_at`, `updated_at`. Unique `(shop_id, platform, customer_external_id)`.
  - **`conversation_messages`** — backs live-chat history + Realtime feed: `id`, `conversation_id` FK,
    `direction ('in'|'out')`, `sender ('customer'|'ai'|'human')`, `body TEXT`, `external_message_id`,
    `created_at`. Index on `(conversation_id, created_at)`.
  - **`ai_message_logs`** — `id`, `conversation_id` FK, `message_external_id VARCHAR` (unique). Used to
    distinguish AI-sent WhatsApp messages from owner-typed ones for the phone-takeover detector.
  - RLS on all four; index `clients_channels(shop_id)`, `conversations(shop_id, last_message_at)`.
  - Enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE conversations, conversation_messages;`

> Migrations are run manually in Supabase SQL Editor (project convention) — note this in the PR.

---

## STEP 2 — Shared utilities (reused by all channels)

- **`apps/web/lib/crypto.ts`** (NEW) — `encryptSecret(plain)` / `decryptSecret(blob)` using
  `crypto` AES-256-GCM with `ENCRYPTION_KEY` (32-byte hex env). Output `iv:tag:ciphertext`. Mirror in
  bot-server (or share via a tiny copied module since the monorepo has no shared lib package).
- **`apps/web/lib/ai-inference.ts`** (NEW) — factor the prompt assembly currently inlined in
  `apps/web/app/api/widget-chat/route.ts` (lines ~307–348) into one reusable function:
  `runAIReply({ shop, history, message }) → string`. Internally reuses the existing
  `buildTrainingData()` (`lib/widget-training.ts`), `getGlobalAIRules()` + `getCategoryPrompt()`
  (`lib/platform-settings.ts`), and the `genAI` client (`lib/gemini.ts`). **Then refactor `widget-chat`
  and `v1/ai/chat` to call it** — same behavior, no duplication, zero change to existing endpoints' I/O.
- **Reuse for orders, no rewrite**: the routing engine calls the existing `extractAndSave()`
  (widget-chat) pattern and `dispatchWebhook()` (`lib/webhook-delivery.ts`) so Messenger/WhatsApp orders
  flow into `orders`, fire `order.created`/`appointment.created`, and push notifications exactly like chat today.

---

## STEP 3 — `apps/bot-server` (NEW Railway service)

Scaffold mirroring `apps/voice-server` (package.json scripts `dev/build/start`, `tsconfig.json`,
`Dockerfile` node:22-alpine, `railway.json`). Deps: `@whiskeysockets/baileys`, `@supabase/supabase-js`,
`@google/genai`, `express` (lightweight internal HTTP for FB-send + WA-send endpoints), `pino`, `qrcode`,
`dotenv`. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`,
`BOT_INTERNAL_SECRET`, `META_APP_SECRET`, `WEB_URL`.

Structure:
```
apps/bot-server/src/
├── index.ts                 # http server + boot: rehydrate all active WA sessions on startup
├── supabase.ts              # service-role client
├── crypto.ts                # AES-256-GCM (shared with web)
├── whatsapp/manager.ts      # WhatsAppManager: Map<shopId, sock> (multi-tenant)
├── whatsapp/authState.ts    # Baileys auth state <-> clients_channels.wa_session_data (encrypted)
├── routing/engine.ts        # shared inbound routing + takeover (used by FB + WA)
├── ai.ts                    # calls Gemini (same 4-layer assembly as web lib/ai-inference)
└── realtime.ts              # writes conversation_messages rows + broadcast (QR, alerts)
```

### WhatsApp (Baileys) — STEP 3 of request
- `WhatsAppManager` holds `Map<shopId, WASocket>`; `initWhatsAppSession(shopId)`:
  - Build auth state from `clients_channels.wa_session_data` (decrypt) or fresh
    (`useMultiFileAuthState`-style adapter backed by DB, not disk).
  - `connection.update`: on **QR** → render base64 (`qrcode`) → Supabase Realtime broadcast to
    channel `shop:{shopId}` event `wa_qr`; on **`open`** → persist encrypted creds, set
    `clients_channels.is_active=true`, broadcast `wa_connected`; on **`close`** → reconnect unless
    logged out (DisconnectReason.loggedOut → mark inactive, clear session).
  - `creds.update`: persist encrypted creds back to DB (keeps session permanent across restarts).
- On boot, `index.ts` loads all `clients_channels` where `channel_type='whatsapp' AND is_active` and
  re-inits each socket → permanent connection survives Railway redeploys.

### Facebook Messenger — STEP 2 of request
- OAuth (Meta Login for Business) handled in **Next.js** (mirrors Google Calendar OAuth exactly):
  - `apps/web/app/api/integrations/facebook/connect/route.ts` — build Meta OAuth URL, base64url `state` = shopId.
  - `apps/web/app/api/integrations/facebook/callback/route.ts` — exchange code → long-lived user token →
    `GET /me/accounts` → store page id + **encrypted** page token in `clients_channels`; then call the
    subscribe step.
  - `apps/web/lib/facebook.ts` (NEW) — Graph API helpers: `exchangeCode`, `getLongLivedToken`,
    `getPages`, `subscribeApp(pageId, token)` → `POST /{pageId}/subscribed_apps` with
    `subscribed_fields=messages,messaging_postbacks`, `sendMessage(pageId,token,psid,text)`.
- Webhook receiver in **Next.js** (request/response — fine for FB):
  - `apps/web/app/api/webhooks/facebook/route.ts` — `GET` verify (`hub.challenge` vs `META_VERIFY_TOKEN`);
    `POST` validate `X-Hub-Signature-256` (HMAC `META_APP_SECRET`) → parse entries → for each message call
    the **routing engine** (shared logic, imported into web from `lib/routing.ts`).

> Routing logic exists in **two runtimes** (Next.js for FB inbound, bot-server for WA inbound). Implement
> it once in `apps/web/lib/routing.ts` and have bot-server import an equivalent module; both operate on the
> same DB tables + same `runAIReply`. Keep them in sync (small surface).

---

## STEP 4 — Routing engine & smart human takeover (request STEP 4)

`handleInboundMessage({ shopId, platform, externalId, customerName, text, externalMessageId })`:
1. Upsert `conversations` row by `(shop_id, platform, customer_external_id)`; insert inbound
   `conversation_messages` row (`direction='in'`) → Supabase Realtime auto-pushes to dashboard.
2. **Auto-resume check**: if `is_ai_paused` and `paused_at` older than 30 min → set `is_ai_paused=false`
   (handles the spec's timeout fallback inline; plus a cron as backstop — see below).
3. If `is_ai_paused` → **do not** call AI (human is handling); message already broadcast. Stop.
4. Else → `runAIReply()` → send via channel (FB Graph API / bot-server WA send) → insert outbound
   `conversation_messages` (`sender='ai'`), and **log returned message id into `ai_message_logs`** →
   run existing `extractAndSave()` for orders/appointments + `dispatchWebhook()`.

**Physical-phone takeover (WhatsApp-specific)** — in Baileys `messages.upsert`:
- For `msg.key.fromMe === true`: look up `ai_message_logs.message_external_id = msg.key.id`.
  - **Found** → it's our own AI message, ignore.
  - **Not found** → owner typed it from their phone → set `conversations.is_ai_paused=true`,
    `paused_at=now()`, `pause_reason='phone'`, insert a `conversation_messages` (`sender='human'`),
    broadcast `ai_paused_by_phone` over Realtime.

**Dashboard controls** (replaces spec's Socket.io listeners with Next.js routes + Realtime):
- `apps/web/app/api/livechat/conversations/route.ts` — list/paginate conversations.
- `apps/web/app/api/livechat/[id]/messages/route.ts` — history (GET) + human send (POST → routes to
  FB/WA outbound, inserts `sender='human'`).
- `apps/web/app/api/livechat/[id]/pause/route.ts` & `…/resume/route.ts` — flip `is_ai_paused`
  (`pause_reason='dashboard'`). Resume clears `paused_at`.
- **Auto-resume cron**: `apps/web/app/api/cron/livechat-resume/route.ts` (X-Cron-Secret header, matching
  existing cron-secret pattern) → resets paused conversations older than 30 min. Backstop to the inline
  check in step 2.

---

## STEP 5 — Dashboard UI (live chat + connection panels)

- **Integrations panels** (mirror `GoogleCalendarPanel.tsx` / `TelephonyPanel.tsx` styling):
  - `apps/web/app/(dashboard)/integrations/FacebookPanel.tsx` — Connect (Meta Login) / status / disconnect.
  - `apps/web/app/(dashboard)/integrations/WhatsAppPanel.tsx` — "Link device" → subscribes to Supabase
    Realtime `shop:{shopId}`, renders base64 QR live, flips to "Connected" on `wa_connected`.
  - Register both in `apps/web/app/(dashboard)/integrations/page.tsx` (gated like existing panels).
- **Live Chat page**: `apps/web/app/(dashboard)/livechat/page.tsx` + client component — conversation list
  (left) + thread view (right), subscribes to Supabase Realtime on `conversation_messages`/`conversations`,
  AI-paused badge, **Pause AI / Resume AI** buttons, human reply box, and an alert toast on
  `ai_paused_by_phone`. Add nav entry (`lib/category-nav.ts` + dashboard layout).
- Bot-server WA-send + a thin Next.js → bot-server internal call (shared `BOT_INTERNAL_SECRET`) so the
  dashboard/human reply and AI reply can both push WhatsApp messages through the live socket.

---

## Critical files

**New:** `supabase/migrations/020_omnichannel.sql`; `apps/web/lib/{crypto,ai-inference,facebook,routing}.ts`;
`apps/web/app/api/integrations/facebook/{connect,callback,status,disconnect}/route.ts`;
`apps/web/app/api/webhooks/facebook/route.ts`; `apps/web/app/api/livechat/**`;
`apps/web/app/api/cron/livechat-resume/route.ts`; `apps/web/app/(dashboard)/integrations/{FacebookPanel,WhatsAppPanel}.tsx`;
`apps/web/app/(dashboard)/livechat/**`; entire `apps/bot-server/**`.

**Modified (minimal, behavior-preserving):** `apps/web/app/api/widget-chat/route.ts` &
`apps/web/app/api/v1/ai/chat/route.ts` (call `runAIReply`); `apps/web/app/(dashboard)/integrations/page.tsx`;
`lib/category-nav.ts` + dashboard layout (nav); root `package.json`/`pnpm-workspace.yaml`/`turbo.json`
(register `apps/bot-server`); `CLAUDE.md` (document new service, env vars, migration 020).

**Reused as-is:** `lib/widget-training.ts`, `lib/platform-settings.ts`, `lib/gemini.ts`,
`lib/webhook-delivery.ts`, `extractAndSave()` extraction, `lib/supabase/server.ts` (`createAdminClient`).

---

## New environment variables (document in CLAUDE.md; user sets in Railway)
- Web: `ENCRYPTION_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_VERSION`,
  `BOT_SERVER_URL`, `BOT_INTERNAL_SECRET`, `LIVECHAT_RESUME_SECRET`.
- bot-server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`,
  `BOT_INTERNAL_SECRET`, `META_APP_SECRET`, `WEB_URL`, `PORT`.

---

## Verification

1. **Build/typecheck**: `pnpm -w build` (web + bot-server compile); `tsc --noEmit` in bot-server.
2. **Migration**: apply `020_omnichannel.sql` on a Supabase dev project; confirm tables, enum, RLS, and
   Realtime publication.
3. **No-regression**: hit existing `/api/widget-chat` and `/api/v1/ai/chat` — identical replies after the
   `runAIReply` refactor (the key risk; test before/after).
4. **Crypto**: round-trip unit test `decryptSecret(encryptSecret(x)) === x`.
5. **WhatsApp**: run bot-server locally → WhatsAppPanel renders QR via Realtime → scan with a test number →
   `connection:'open'` persists encrypted creds → restart bot-server → session auto-restores (no re-scan).
   Send a customer message → AI replies; reply from the linked phone → conversation auto-pauses
   (`ai_paused_by_phone`) and AI goes silent.
6. **Facebook**: use Meta Graph API Explorer / a test page → OAuth connect stores encrypted token +
   subscribes app → send a Messenger message → webhook → AI reply; verify `X-Hub-Signature-256` rejects
   forged payloads.
7. **Takeover/controls**: dashboard Pause AI → incoming msg not answered by AI, shown live; Resume AI →
   AI answers again; leave paused 30 min (or force cron) → auto-resumes.
8. **Orders**: confirm an order over Messenger/WhatsApp → row in `orders`, `order.created` webhook fires,
   push notification arrives (proves reuse of existing pipeline).

---

## Delivery
One draft PR on `claude/saas-facebook-whatsapp-livechat-p9nbwc`, commits grouped: (1) migration + crypto +
ai-inference refactor, (2) bot-server + Baileys, (3) Facebook OAuth + webhook, (4) routing engine + takeover,
(5) live-chat dashboard + panels, (6) CLAUDE.md/env docs. Mirror any PR template if present.

### Caveats to flag in the PR
- **Baileys is unofficial** — WhatsApp may ban numbers; advise a dedicated business number.
- Single-instance assumption (in-memory WA sockets + existing KB/rate-limit caches): keep web **and**
  bot-server at 1 Railway instance each, or move shared state to Redis later.
- Meta app needs **App Review** (`pages_messaging`) before non-test users; document the test-user path.
