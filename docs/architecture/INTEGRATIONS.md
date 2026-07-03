# Integrations

---

## Google Calendar

**Files:** `app/(dashboard)/integrations/GoogleCalendarPanel.tsx`, `app/api/calendar/`

Only available for booking categories: `clinic`, `salon`, `services`.

### OAuth Flow
1. User clicks "Connect Google Calendar" in integrations page (`#google-calendar`)
2. `GET /api/calendar/connect` → generates OAuth URL → redirect to Google
3. Google redirects to `GET /api/calendar/callback` with `?code=`
4. Callback exchanges code for tokens, stores in `calendar_integrations` table
5. Redirect to `/integrations?cal=connected&email={email}` → success banner

**Required Google Cloud:** OAuth 2.0 credentials with Calendar API scope. Add test users in OAuth consent screen until Google verifies the app.

### Auto-Sync
When an appointment is booked (AI extracts order with appointment time):
- `POST /api/voice/save-session` calls calendar sync
- Creates event in merchant's calendar
- Logs in `calendar_events` table

---

## SIP Telephony

**Files:** `scratch/bridge.js` (VPS: `/var/www/bridge/bridge.js`), `app/(dashboard)/integrations/TelephonyPanel.tsx`

### Architecture
```
Asterisk PBX (:5060)
  └── extensions.conf: all calls → AudioSocket(:9092)
      └── bridge.js (TCP server)
          ├── 8kHz G.711 → 24kHz PCM upscale
          ├── Noise gate (silence suppression)
          └── WebSocket → Voice Server (:8080)
```

### Telephony Config (per shop)
Stored in `shops.ai_config.telephony`:
```json
{
  "status": "active",
  "did": "9644840050",
  "provider": "Alliance",
  "sip_host": "123.0.31.250"
}
```

### Enabling Telephony
1. God admin: enable `voip_enabled` flag for the shop
2. Merchant: enters DID number in TelephonyPanel → saved to `ai_config.telephony`
3. bridge.js picks up on next 5-minute poll cycle

### Registered Trunks
| Trunk | DID | Status |
|---|---|---|
| trunk2 (ACTIVE) | 09644840050 | Alliance Dental — in use |
| trunk1 (deprecated) | 09617854561 | Registered but not assigned to any shop |

### bridge.js Key Behaviors
- Polls `/api/voice/telephony-sync` every 5 minutes for active shops
- DID matching strips leading zeros: `09644840050` → `9644840050`
- Asterisk reloaded via `asterisk -rx 'core reload'` when SIP IPs change (NOT docker exec)
- Connects to Voice Server via `ws://127.0.0.1:8080` (localhost — no network hop)

---

## Website Widget

**File:** `public/embed.js`

Merchants paste one `<script>` tag into their website. The script:
1. Creates a floating bubble button (bottom-right)
2. On click: injects a full-screen `<iframe>` pointing to `/widget/{shopId}?mode=voice&autostart=1`
3. On close: removes iframe from DOM

The widget iframe loads voice+chat UI. `autostart=1` triggers immediate voice connection without a second tap.

### Embed Configurator
`app/(dashboard)/integrations/EmbedConfigurator.tsx` lets merchants:
- Set primary color
- Choose voice-only, chat-only, or both
- Preview the widget
- Copy the embed `<script>` tag

---

## Public API v1

**Base URL:** `{NEXT_PUBLIC_APP_URL}/api/v1`  
**Auth:** `Authorization: Bearer {api_key}`

All API keys are SHA-256 hashed at rest. Max 4 active keys per shop.

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/v1/me` | Shop info |
| GET/POST | `/v1/customers` | List / create customers |
| GET/PUT/DELETE | `/v1/customers/[id]` | Single customer |
| GET/POST | `/v1/orders` | List / create orders |
| GET/PUT/DELETE | `/v1/orders/[id]` | Single order |
| GET/POST | `/v1/appointments` | List / create appointments |
| GET/PUT/DELETE | `/v1/appointments/[id]` | Single appointment |
| GET/POST | `/v1/products` | List / upsert-by-SKU products |
| GET/PUT/DELETE | `/v1/products/[id]` | Single product |
| PUT/DELETE | `/v1/knowledge` | WordPress knowledge chunk sync |
| POST | `/v1/ai/chat` | AI chat with full 4-layer context |
| POST | `/v1/ai/order` | Extract + save order from free text |
| GET/POST | `/v1/webhooks` | List / create webhook endpoints |
| PUT/DELETE | `/v1/webhooks/[id]` | Single webhook |

### Webhooks
Outbound webhook events fired on:
- `order.created` — when AI captures an order (voice or chat)
- `appointment.created` — when AI books an appointment

Delivery: fire-and-forget POST with `X-KothaBot-Signature: hmac-sha256=...` header. Logged in `webhook_deliveries`.

---

## WordPress Plugin (KothaBot Connect)

**Source:** `wordpress-plugin/kothabot-connect/`  
**Install:** upload `wordpress-plugin/kothabot-connect.zip` to WP admin → Plugins → Add New

### Features
1. **Settings page** — enter KothaBot API key (validated against `/api/v1/me`)
2. **WooCommerce product sync** — real-time on product save/delete + daily WP-Cron batch sync. Upserts by SKU via `POST /api/v1/products`
3. **WooCommerce order sync** — on checkout completion → `POST /api/v1/orders`. Loop guard: skips if `_kothabot_origin` meta set.
4. **Knowledge sync** — on page publish/update → `PUT /api/v1/knowledge`. Elementor/Divi: fetches permalink URL, strips HTML, extracts text.
5. **Widget embed** — auto-injects `embed.js` via `wp_footer` hook. Configurable in settings.
6. **Webhook receiver** — `/wp-json/kothabot/v1/webhook` — receives `order.created` / `appointment.created` from KothaBot → creates WC order or triggers Amelia booking. HMAC verified.
7. **Amelia sync** — two-way: Amelia bookings → KothaBot appointments; KothaBot appointments → Amelia (via `kothabot_create_amelia_booking` filter, version-dependent).

### Loop Prevention
- WC orders carry `_kothabot_synced` + `_kothabot_origin=woocommerce` meta
- KothaBot orders carry `metadata.wc_order_id` when created from WC
- Both sides check these fields before creating to prevent echo loops

---

## Backup & Restore

**Files:** `app/api/backup/`, `app/(dashboard)/settings/backup/`

- **Manual backup:** `POST /api/backup/create` → dumps shop data (orders, customers, products, training) to JSON → uploads to Supabase Storage
- **Scheduled backup:** `POST /api/backup/cron` — requires `BACKUP_CRON_SECRET` header. Triggered by external cron job.
- **Restore:** Downloads backup JSON from Storage → re-inserts rows (skips duplicates by primary key)

---

## Lead Capture

**File:** `app/(dashboard)/integrations/LeadCaptureToggle.tsx`

Toggle `widget_config.requirePhone`. When enabled, the chat widget requires the visitor to enter their phone number before the AI responds. Captured phone stored in `customers` table.
