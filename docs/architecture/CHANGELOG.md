# Changelog

Build history for KothaBot v2.0.

---

## Build 146 — 2026-06-14

**Navigation refactor + Feature flags + Regional billing**

- **Nav:** `lib/nav-items.ts` created as single source of truth. `BUSINESS_NAV` + `PLATFORM_NAV` shared by Sidebar and BottomNav. `isNavItemActive()` handles sub-page specificity.
- **Sidebar:** Collapsible "Platform & Tools ▼" section. Auto-expands when on a platform page.
- **BottomNav:** Primary tabs: Dashboard / Orders / Customers / Analytics / More. More-sheet contains all leftover items.
- **PLATFORM_NAV additions:** API Access (`/integrations#api-access`), Google Calendar (`/integrations#google-calendar`), Backup & Restore (`/settings/backup`).
- **Feature flags:** `voip_enabled`, `api_access_enabled`, `white_label` per shop. All default OFF. Toggled by god admin only via `FeatureToggle.tsx` + `/api/admin/set-shop-feature`.
- **Billing:** `platform-types.ts` (client-safe) split from `platform-settings.ts` (server-only). `methodsForRegion()` filters payment methods dynamically.
- **Payments:** Paddle added alongside bKash/Nagad/Rocket. `PaymentModal` fully config-driven. `PaymentSettingsForm` handles 4 methods + region pills.
- **Regional analytics:** BD/Global/Unassigned shop count card in admin dashboard.
- **Admin UI:** "International" → "Global"; "Lemon Squeezy" → "Paddle".
- **Env-driven URLs:** `NEXT_PUBLIC_VOICE_LINK_URL`, `NEXT_PUBLIC_APP_URL` used in all voice link displays and API base URLs.

---

## Build 105 — 2026-06-12

**VPS Migration + SIP Telephony**

- Full migration from Railway to Contabo VPS (163.128.144.171)
- Nginx reverse proxy + SSL (Let's Encrypt) at my.kothabot.ai.bd
- Asterisk PBX: 2 SIP trunks registered
- bridge.js: audio resampling (8kHz↔24kHz), noise gate, DID matching
- TelephonyPanel redesigned (IP Phone Connection UI)
- bridge.js now calls `asterisk -rx 'core reload'` directly (not via docker exec)

---

## Build 104 — 2026-06-11

**Subscription Lockout**

- `past_due` accounts redirected to billing page from dashboard layout
- Widget padlock screen for unpaid merchants
- API/voice call blocking for past_due subscriptions

---

## Build 96 — 2026-06-09

**Transcript Retention**

- Order-linked transcripts kept permanently (`order_linked = true`)
- Non-order transcripts auto-deleted after 7 days
- `POST /api/voice/cleanup-transcripts` (cron endpoint)
- Dashboard transcript viewer with modal
- Migration 016 required

---

## Build 95 — 2026-06-09

**Session Analytics**

- `voice_sessions.end_reason` field: `completed`, `inactivity`, `off_topic_limit`, `plan_limit`
- `voice_sessions.off_topic_count` field
- Analytics page: call breakdown by end_reason
- Migration 015 required

---

## Build 94 — 2026-06-09

**AI Cost Protection (AI Abuse Shield)**

- Off-topic 3-strike system with Bangla + English refusal pattern detection
- Plan-based duration caps: Trial=3min, Starter=5min, Pro=8min, Business=12min
- 40-second inactivity timeout
- Session analytics tracking
- `/api/voice/check-limit` returns `maxDuration` to voice server

---

## Builds 69–79 — 2026-06-05

**Public API Layer (migration 013)**

- `api_keys` table, API key generation (max 4 active, SHA-256 hashed)
- Public API v1: `/api/v1/me`, customers, orders, appointments, products, ai/chat, ai/order
- Webhooks: `webhook_endpoints`, `webhook_deliveries`
- `order.created` / `appointment.created` webhook events from voice + chat
- Dashboard API keys UI
- Admin panel expanded
- Voice transcript shows AI messages only + auto-scroll

---

## Builds 42–68 — 2026-06-05

**Major features batch**

- Google OAuth (Supabase provider)
- 11 business categories (added real_estate, education, creative_agency)
- AI Knowledge Extraction Engine (`/api/training/extract-website`, Gemini)
- `knowledge_sources` + `knowledge_chunks` tables (migration 011)
- Backup & Restore system (migration 012, Supabase Storage)
- Google Calendar integration (migration 014, OAuth 2.0)
- Cache-control headers for static assets

---

## Build 29 — 2026-06-03

**Text chat + Voice Links + Usage Limits**

- Text chat widget (Gemini Flash Lite, SSE streaming)
- Voice/chat mode toggles in widget
- Public Voice Links: `call.kothabot.ai.bd/v/{slug}` (migration 008)
- Usage limits system (migration 009)
- Global AI rules (platform_settings)
- Mobile bottom nav fixes
- Domain setup: my.kothabot.ai.bd, call.kothabot.ai.bd

---

## Builds 1–28 — Before 2026-06-03

**Core Platform**

- Multi-tenant dashboard with 8 initial business categories
- Email/password Supabase auth
- Product/service CRUD with category-aware fields
- Order management with AI-extracted orders
- Customer/patient management
- Voice AI widget (Gemini Live, 90s session chunking)
- `platform_settings` key-value store (migration 002)
- Admin panel (PIN auth, shop management, payment review)
- Subscription system (migrations 001–007)
- DB performance indexes (migration 017)
- SKU composite index (migration 018)

---

## WordPress Plugin — 2026-06-14

**KothaBot Connect plugin (v1.0)**

- WooCommerce product sync (real-time hooks + WP-Cron batch)
- WooCommerce order sync with loop prevention
- Page knowledge sync (Elementor/Divi compatible via fetch_rendered fallback)
- Widget embed via wp_footer
- Webhook receiver (HMAC verified): `order.created` → WC, `appointment.created` → action
- Amelia two-way sync (outbound best-effort via filter hook)
- Settings page with API key validation

---

## Open Issues / Roadmap

| Status | Item |
|---|---|
| 🟡 OPEN | Rate limiter breaks at >1 PM2 instance — use Redis |
| 🟡 OPEN | Webhook delivery retry cron (currently fire-and-forget) |
| 🟡 OPEN | WhatsApp / Messenger / Telegram webhooks |
| 🟡 OPEN | Google Sheets integration |
| 🟡 OPEN | Email verification for new signups |
| 🟡 OPEN | UFW firewall not enabled on VPS |
| 🟡 OPEN | Google Calendar OAuth app not yet verified by Google |
| 🟡 OPEN | Paddle webhook receiver for automatic subscription activation |
| 🟡 OPEN | WordPress plugin not yet installed on myhealth.us (needs re-upload with Elementor fix) |
| 🟡 OPEN | Alliance Dental shop needs `voip_enabled=true` in god admin (VoIP now defaults off) |
