# API Reference

All routes are under `apps/web/app/api/`. Authentication varies by route type.

---

## Authentication Types

| Type | How | Used By |
|---|---|---|
| Supabase session | Cookie (httpOnly) | All dashboard page routes |
| Admin PIN cookie | Cookie set at `/admin-login` | All `/api/admin/*` routes |
| Bearer API key | `Authorization: Bearer {key}` | All `/api/v1/*` routes |
| Gateway token | `Authorization: Bearer {GATEWAY_TOKEN}` | `/api/voice/telephony-sync` |
| Cron secret | `X-Cron-Secret: {secret}` | Cron-triggered routes |

---

## Voice Routes

### `GET /api/voice/check-limit`
Check if a shop has remaining voice calls and return the plan duration cap.

**Auth:** Supabase session (widget fetches with shopId)  
**Response:**
```json
{
  "allowed": true,
  "remaining": 45,
  "maxDuration": 480,
  "plan": "pro"
}
```

### `POST /api/voice/save-session`
Save a completed voice session transcript and attempt to extract an order.

**Auth:** Internal (called by voice server)  
**Body:**
```json
{
  "shopId": "uuid",
  "sessionId": "string",
  "transcript": "string",
  "durationSeconds": 120,
  "endReason": "completed",
  "offTopicCount": 0
}
```

### `GET /api/voice/telephony-sync`
Returns all shops with active telephony configs. Used by bridge.js.

**Auth:** `Authorization: Bearer {GATEWAY_TOKEN}`  
**Response:**
```json
{
  "shops": [
    {
      "shopId": "uuid",
      "did": "9644840050",
      "shopName": "Alliance Dental",
      "category": "clinic",
      "apiKey": "...",
      "systemPrompt": "...",
      "language": "bn"
    }
  ]
}
```

### `GET /api/voice/system-config`
Returns SIP provider IPs for Asterisk dynamic config.

**Auth:** Internal  
**Response:** `{ "sipIps": ["123.0.31.250", "202.40.176.2"] }`

### `GET /api/voice/transcripts`
List voice session transcripts for the authenticated shop.

**Auth:** Supabase session  
**Query params:** `page`, `limit`, `order_linked`

### `POST /api/voice/cleanup-transcripts`
Delete non-order transcripts older than 7 days.

**Auth:** `X-Cron-Secret` header

### `GET /api/voice/widget-context`
Lazy-load endpoint: returns the full training data context for the widget. Called when call button is pressed (not on page load).

**Auth:** Supabase session

---

## Widget Chat

### `POST /api/widget-chat`
Text chat with the AI assistant. Returns SSE stream.

**Auth:** None (public, rate-limited by shopId)  
**Body:** `{ "shopId": "uuid", "message": "string", "history": [...] }`  
**Response:** `text/event-stream` with `data: {token}` lines

---

## Billing Routes

### `POST /api/billing/submit-payment`
Submit a manual payment (bKash/Nagad/Rocket).

**Auth:** Supabase session  
**Body:** `{ "planId": "pro", "method": "bkash", "transactionId": "ABC123", "amount": 1999 }`

---

## Admin Routes

All require admin PIN cookie.

### `POST /api/admin/update-settings`
Update a platform_settings key.

**Body:** `{ "key": "plans", "value": {...} }`

### `POST /api/admin/set-shop-feature`
Toggle a feature flag on a shop.

**Body:** `{ "shopId": "uuid", "feature": "voip_enabled", "enabled": true }`  
**Allowed features:** `voip_enabled`, `api_access_enabled`, `white_label`

### `POST /api/admin/set-shop-region`
Set a shop's billing region.

**Body:** `{ "shopId": "uuid", "region": "BD" | "INTL" }`

### `POST /api/admin/generate-access-link`
Generate a magic login link for a shop owner.

**Body:** `{ "shopId": "uuid" }`  
**Response:** `{ "url": "https://my.kothabot.ai.bd/login#access_token=..." }`

### `GET /api/admin/settings/sip-ips`
List current SIP provider IPs.

### `POST /api/admin/settings/sip-ips`
Add or remove a SIP provider IP.

**Body:** `{ "action": "add" | "remove", "ip": "123.0.31.250" }`

---

## Calendar Routes

All require Supabase session.

| Route | Method | Description |
|---|---|---|
| `/api/calendar/connect` | GET | Generate Google OAuth URL |
| `/api/calendar/callback` | GET | OAuth code exchange |
| `/api/calendar/status` | GET | Check if connected, return email |
| `/api/calendar/disconnect` | POST | Revoke + delete tokens |
| `/api/calendar/test` | POST | Create test event |
| `/api/calendar/settings` | GET/PUT | Calendar-specific settings |

---

## Training Routes

### `POST /api/training/extract-website`
Extract knowledge from a URL using Gemini.

**Auth:** Supabase session  
**Body:** `{ "url": "https://example.com", "sourceId": "uuid" }`

---

## Voice Links

### `POST /api/voice-links/setup`
Create a new public voice link.

**Auth:** Supabase session  
**Body:** `{ "slug": "my-business", "label": "Main Line" }`  
**Uses:** `NEXT_PUBLIC_VOICE_LINK_URL ?? 'https://call.kothabot.ai.bd'`

---

## Backup Routes

### `POST /api/backup/create`
Create a manual backup.

**Auth:** Supabase session  
**Response:** `{ "filename": "backup-2026-06-15.json", "sizeBytes": 45231 }`

### `POST /api/backup/cron`
Trigger scheduled backup for all shops.

**Auth:** `X-Cron-Secret` header

---

## API Keys

### `GET /api/api-keys`
List API keys for the authenticated shop.

**Auth:** Supabase session

### `POST /api/api-keys`
Generate a new API key (max 4 active).

**Auth:** Supabase session  
**Response:** `{ "key": "kb_live_...", "id": "uuid" }` — key shown only once

### `DELETE /api/api-keys?id={id}`
Revoke an API key.

---

## Public API v1

**Base:** `{APP_URL}/api/v1`  
**Auth:** `Authorization: Bearer {api_key}`

### `/v1/me`
`GET` — Returns shop info, plan, category.

### `/v1/customers`
`GET` — List customers (paginated)  
`POST` — Create customer

### `/v1/customers/[id]`
`GET` — Single customer  
`PUT` — Update  
`DELETE` — Delete

### `/v1/orders`
`GET` — List orders (paginated, filterable by status)  
`POST` — Create order

### `/v1/orders/[id]`
`GET` `PUT` `DELETE`

### `/v1/appointments`
`GET` `POST` — Same shape as orders, filtered by `metadata.appointment_time`

### `/v1/appointments/[id]`
`GET` `PUT` `DELETE`

### `/v1/products`
`GET` — List products  
`POST` — Create or upsert by SKU. Single: `{name, sku, price}`. Bulk: `{ "products": [...] }`

### `/v1/products/[id]`
`GET` `PUT` `DELETE`

### `/v1/knowledge`
`PUT` — Create/update a WordPress knowledge chunk  
**Body:** `{ "url": "https://...", "title": "Page Title", "content": "extracted text" }`

`DELETE` — Remove a knowledge chunk by URL  
**Body:** `{ "url": "https://..." }`

### `/v1/ai/chat`
`POST` — Chat with the AI using the shop's full context  
**Body:** `{ "message": "string", "sessionId": "string" }`

### `/v1/ai/order`
`POST` — Extract and save an order from free text  
**Body:** `{ "text": "I want 2 burgers delivered to..." }`

### `/v1/webhooks`
`GET` — List webhook endpoints  
`POST` — Create webhook endpoint  
**Body:** `{ "url": "https://...", "events": ["order.created"] }`

### `/v1/webhooks/[id]`
`GET` `PUT` `DELETE`

---

## Rate Limiting

In-memory rate limiter (single PM2 instance — Redis migration pending for multi-instance).

| Route group | Limit |
|---|---|
| `/api/widget-chat` | 30 req/min per shopId |
| `/api/v1/*` | 60 req/min per API key |
| `/api/voice/*` | 10 req/min per shopId |
