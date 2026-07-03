# MASTER ADMIN AUDIT

> KothaBot v2.0 · Build 146 · Audited: 2026-06-15  
> Purpose: Complete overview of the Master Admin architecture for professional reorganisation.  
> Source: Direct code analysis — `app/(admin)/`, `lib/`, `lib/nav-items.ts`, `lib/platform-settings.ts`

---

## 1. CURRENT MASTER ADMIN MENUS

The Master Admin panel lives at `/admin-login` (PIN-protected, entirely separate from Supabase user auth). Navigation is rendered as a flat row of icon-buttons across the top header bar — there is no sidebar.

| # | Menu Label | Route | Page Component | Description | Access |
|---|---|---|---|---|---|
| 1 | **Dashboard** | `/admin` | `app/(admin)/admin/page.tsx` | Stats overview (clients, orders, calls, pending payments), regional split (BD/Global/Unassigned), full client list table with AI model + onboarding status | Master Admin only |
| 2 | **Pay** | `/admin/payments` | `app/(admin)/admin/payments/page.tsx` | Review and confirm/reject manual payment requests (bKash, Nagad, Rocket). Shows pending count as red badge. | Master Admin only |
| 3 | **Help** | `/admin/support` | `app/(admin)/admin/support/page.tsx` | Support ticket inbox — view, reply, change status (open/pending/resolved). Unread badge on nav. | Master Admin only |
| 4 | **Emails** | `/admin/emails` | `app/(admin)/admin/emails/page.tsx` | Preview and manage email templates (payment confirmation, subscription created/renewed, welcome, trial ending). | Master Admin only |
| 5 | **Knowledge** | `/admin/knowledge` | `app/(admin)/admin/knowledge/page.tsx` | Cross-tenant knowledge source viewer — see all shops' training URLs, chunk counts, word counts. | Master Admin only |
| 6 | **Backups** | `/admin/backups` | `app/(admin)/admin/backups/page.tsx` | Full platform backup dashboard — all shops' backups, backup logs, status, sizes. | Master Admin only |
| 7 | **API** | `/admin/api` | `app/(admin)/admin/api/page.tsx` | Monitor all client API keys — active keys, 7-day usage logs, error rates, request counts. | Master Admin only |
| 8 | **Calendar** | `/admin/calendar` | `app/(admin)/admin/calendar/page.tsx` | Monitor all Google Calendar integrations — connected shops, events synced, sync errors. | Master Admin only |
| 9 | **Settings** | `/admin/settings` | `app/(admin)/admin/settings/page.tsx` | Platform-wide configuration (plans, payments, SIP IPs, category toggles, AI rules, voice links, trial extensions). | Master Admin only |
| 10 | **Audit** | `/admin/audit` | `app/(admin)/admin/audit/page.tsx` | Admin action audit log — all PIN logins, logouts, failed attempts, payment approvals, settings changes. | Master Admin only |
| — | **Per-Shop** | `/admin/shops/[shopId]` | `app/(admin)/admin/shops/[shopId]/page.tsx` | Deep-dive per shop: plan, region, category, feature flags, AI model, usage limits, login activity, recent orders/calls, support tickets, client settings snapshot, raw ai_config JSON, danger zone (delete). | Master Admin only |

### Settings Page — Sections (all under `/admin/settings`)

| Section | Component | What It Does |
|---|---|---|
| Payment Methods | `PaymentSettingsForm.tsx` | Configure bKash/Nagad/Rocket phone numbers + QR URLs; Paddle checkout URL; enable/disable per method; set BD/INTL region pills |
| Master Admin SIP Providers | `SipSettingsForm.tsx` | Whitelist SIP provider IP addresses (Asterisk auto-accepts calls from these IPs) |
| Signup Categories | `CategoryToggleForm.tsx` | Enable/disable which business categories appear on the registration form |
| Subscription Plans | `PlanSettingsForm.tsx` | Edit plan name, period, call limit, BDT price, USD price (cents), Paddle checkout URL, feature bullet points |
| Voice Settings | `VoiceProtectionForm.tsx` | Toggle in-app browser protection for public voice links |
| Category Prompts — Layer 3 | `CategoryPromptsForm.tsx` | Edit AI booking/order-collection instructions per business category |
| Global AI Rules | `GlobalAIRulesForm.tsx` | System instructions injected into ALL shops' AI sessions |
| Public Voice Links | inline table | Read-only overview of all shops with voice links + 30-day visit/voice-start stats |
| Extend / Override Subscriptions | `TrialExtensionForm.tsx` | Manually extend any shop's trial or subscription end date |

---

## 2. ALL MODULES

### Module: Client Management
- **Purpose:** Register, view, and manage all tenant shops
- **Database Tables:** `shops`, `subscriptions`, `login_activity`
- **Related Pages:** `/admin` (list), `/admin/shops/[shopId]` (detail)
- **Dependencies:** Supabase auth (owner email lookup), `platform_settings` (plan limits)
- **Key Actions:** View all clients, manage per-shop plan/region/category/feature flags, impersonate via magic link, delete shop

### Module: Billing & Payments
- **Purpose:** Manual payment approval workflow (BD); Paddle redirect (INTL)
- **Database Tables:** `payment_requests`, `subscriptions`, `payments`
- **Related Pages:** `/admin/payments`, `/admin/shops/[shopId]` → PlanSelector
- **Dependencies:** `platform_settings['payment_methods']`, `platform_settings['plans']`
- **Key Actions:** Confirm or reject payment requests, extend trials, override plan end dates

### Module: Support
- **Purpose:** Handle client support tickets
- **Database Tables:** `support_tickets`
- **Related Pages:** `/admin/support`, `/admin/shops/[shopId]` → Support Tickets panel
- **Dependencies:** None
- **Key Actions:** Read tickets, reply, change status, track unread count

### Module: Email Templates
- **Purpose:** Preview and manage transactional email templates
- **Database Tables:** None (templates in `lib/email-templates.ts`)
- **Related Pages:** `/admin/emails`
- **Dependencies:** Resend SDK, `lib/email-templates.ts`
- **Key Actions:** Preview HTML templates for payment confirmation, subscription events, welcome emails, trial ending

### Module: AI Knowledge Base (Admin View)
- **Purpose:** Cross-tenant view of all client knowledge sources
- **Database Tables:** `knowledge_sources`, `knowledge_chunks`
- **Related Pages:** `/admin/knowledge`
- **Dependencies:** None
- **Key Actions:** See which shops have trained their AI, word/chunk counts per shop

### Module: Backup System (Admin View)
- **Purpose:** Platform-wide backup monitoring
- **Database Tables:** `backups`, `backup_logs`
- **Related Pages:** `/admin/backups`
- **Dependencies:** Supabase Storage
- **Key Actions:** View all shop backups, logs, status, sizes

### Module: API Management
- **Purpose:** Monitor and control all client API key usage
- **Database Tables:** `api_keys`, `api_usage_logs`
- **Related Pages:** `/admin/api`
- **Dependencies:** Public API v1 (`/api/v1/*`)
- **Key Actions:** View all active keys, 7-day request logs, error rates

### Module: Calendar Integration (Admin View)
- **Purpose:** Monitor all shops' Google Calendar connections
- **Database Tables:** `calendar_integrations`, `calendar_events`
- **Related Pages:** `/admin/calendar`
- **Dependencies:** Google Calendar OAuth
- **Key Actions:** See connected shops, events synced, sync errors, last sync timestamp

### Module: Platform Settings
- **Purpose:** Central configuration for the entire platform
- **Database Tables:** `platform_settings` (key-value store)
- **Related Pages:** `/admin/settings`
- **Dependencies:** Everything — voice server, billing, registration, AI prompts
- **Key Actions:** Edit payment methods, plan pricing, SIP IPs, category availability, AI rules, category prompts, voice link stats

### Module: Audit Log
- **Purpose:** Security and compliance trail of all admin actions
- **Database Tables:** `admin_audit_log`
- **Related Pages:** `/admin/audit`
- **Key Actions (logged):** `admin_login`, `admin_logout`, `admin_pin_failed`, `admin_pin_locked`, `approve_payment`, `reject_payment`, `update_settings`, `extend_trial`

### Module: Voice System
- **Purpose:** AI voice calls via widget and SIP telephony
- **Database Tables:** `voice_sessions`, `voice_links`, `public_link_visits`
- **Related Pages:** Widget at `/widget/[shopId]`, public voice pages at `/v/[slug]`, admin view in settings (voice links table)
- **Dependencies:** Gemini Live API, voice server (WS), bridge.js (SIP)
- **Key Actions:** Admin can view public voice link stats, toggle in-app browser protection, configure SIP provider IPs

### Module: Per-Shop Feature Flags
- **Purpose:** Enable/disable premium features per shop (all default OFF)
- **Database Tables:** `shops.ai_config` (JSONB flags)
- **Related Pages:** `/admin/shops/[shopId]` → Feature Access
- **Components:** `FeatureToggle.tsx`, `/api/admin/set-shop-feature`
- **Flags:** `voip_enabled`, `api_access_enabled`, `white_label`

---

## 3. CLIENT PANEL MENUS

All client menus are defined in `lib/nav-items.ts`. Labels adapt to business category.

### Business Navigation (always visible — desktop sidebar top-level, mobile primary tabs)

| Menu | Route | Category-Aware Label Examples | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | Dashboard (all categories) | Stats overview |
| Products | `/products` | Medicines (pharmacy), Services (salon), Treatments (clinic), Menu Items (restaurant), Properties (real_estate), Courses (education) | Category-aware fields |
| Orders | `/orders` | Appointments (clinic/salon), Bookings (services), Orders (retail/restaurant) | Icon swaps to Calendar for booking categories |
| Customers | `/customers` | Patients (clinic), Clients (salon/creative), Students (education), Customers (retail) | |
| Leads | `/leads` | Leads (all) | Lead pipeline |
| Analytics | `/analytics` | Analytics (all) | Voice session breakdown |
| Transcripts | `/transcripts` | Transcripts (all) | AI call transcripts |

### Platform & Tools (collapsible on desktop — "More" sheet on mobile)

| Menu | Route | Notes |
|---|---|---|
| Billing | `/billing` | Subscription status, upgrade, payment flow |
| Integrations | `/integrations` | Hub for all connections |
| API Access | `/integrations#api-access` | Only visible if `api_access_enabled=true` |
| Google Calendar | `/integrations#google-calendar` | Only visible for clinic/salon/services categories |
| Voice Links | `/voice-links` | Public shareable AI call pages |
| AI Training | `/training` | Knowledge base (manual FAQs + website extraction) |
| Backup & Restore | `/settings/backup` | Shop data backups |
| Support | `/support` | Ticket creation and history |
| Settings | `/settings` | Shop settings (AI persona, language, widget config) |
| Documentation | `https://kothabot.ai.bd/docs` | External link |

### Category-Grouped Client Menu Differences

**Healthcare (clinic, pharmacy)**
- Products label: Treatments / Medicines
- Orders label: Appointments / Orders
- Customers label: Patients
- Special: Google Calendar integration visible (clinic only)
- Special: Prescription required field on products (pharmacy)

**Salon & Services (salon, services)**
- Products label: Services
- Orders label: Appointments / Bookings
- Customers label: Clients
- Special: Google Calendar integration visible
- Orders icon: Calendar icon instead of ShoppingBag

**Restaurant & Food (restaurant, grocery)**
- Products label: Menu Items / Products
- Orders label: Orders
- Customers label: Customers
- Special: Cuisine, dietary restriction fields on products

**Retail & Pharmacy (retail, pharmacy)**
- Products label: Products / Medicines
- Orders label: Orders
- Customers label: Customers

**Professional Services (real_estate, education, creative_agency)**
- Products label: Properties / Courses / Services
- Orders label: Viewings / Enrollments / Projects
- Customers label: Clients / Students / Clients

---

## 4. MASTER ADMIN FEATURES

| Feature | Location | Description |
|---|---|---|
| **Client List** | `/admin` | All registered shops with category, AI model, status, join date |
| **Regional Stats** | `/admin` | BD / Global / Unassigned client count breakdown |
| **Platform Stats** | `/admin` | Total clients, orders, voice calls, pending payments |
| **Per-Shop Management** | `/admin/shops/[id]` | Full shop control panel |
| **Magic Link Generation** | `/admin/shops/[id]` | Send one-time login link to client without their password |
| **Password Reset** | `/admin/shops/[id]` | Trigger Supabase password reset email |
| **Plan Override** | `/admin/shops/[id]` | Change shop's subscription plan + expiry date |
| **Region Override** | `/admin/shops/[id]` | Set BD or Global billing region |
| **Category Override** | `/admin/shops/[id]` | Change business category (locked from client side) |
| **AI Model Selector** | `/admin/shops/[id]` | Choose Gemini model per shop (Gemini 2.5 / 3.1 etc.) |
| **Feature Flags** | `/admin/shops/[id]` | Toggle VoIP, API Access, White-Label per shop |
| **Usage Monitor** | `/admin/shops/[id]` | View calls used, minutes used, extra quota; reset counter |
| **Login Activity** | `/admin/shops/[id]` | Last 5 logins with IP, browser, city, country |
| **Recent Calls** | `/admin/shops/[id]` | Last 10 voice sessions with status/duration |
| **Recent Orders** | `/admin/shops/[id]` | Last 10 orders with type/status/amount |
| **Support Tickets (per shop)** | `/admin/shops/[id]` | All tickets from this shop with direct link |
| **Client Settings Snapshot** | `/admin/shops/[id]` | Read-only view of AI persona, greeting, widget config |
| **Raw AI Config** | `/admin/shops/[id]` | JSON dump of `ai_config` for debugging |
| **Delete Shop** | `/admin/shops/[id]` | Permanent deletion with double confirmation |
| **Payment Review** | `/admin/payments` | Confirm or reject manual payment requests |
| **Support Tickets (all)** | `/admin/support` | Full inbox with reply, status management |
| **Email Template Preview** | `/admin/emails` | Preview all transactional email templates |
| **Knowledge Overview** | `/admin/knowledge` | Cross-tenant training data audit |
| **Backup Dashboard** | `/admin/backups` | All shop backups and logs |
| **API Key Monitor** | `/admin/api` | All active keys, usage logs, error rates |
| **Calendar Monitor** | `/admin/calendar` | All Google Calendar connections and sync status |
| **Payment Methods Config** | `/admin/settings` | bKash, Nagad, Rocket, Paddle — numbers, QR, regions |
| **SIP Provider IPs** | `/admin/settings` | Whitelist IPs for Asterisk auto-accept |
| **Signup Category Control** | `/admin/settings` | Enable/disable categories shown at registration |
| **Plan Pricing Editor** | `/admin/settings` | Full plan config — prices, limits, features, Paddle URLs |
| **Voice Protection** | `/admin/settings` | In-app browser protection toggle |
| **Category AI Prompts** | `/admin/settings` | Layer 3 prompt editor per business category |
| **Global AI Rules** | `/admin/settings` | Layer 1 platform-wide AI instruction editor |
| **Voice Link Stats** | `/admin/settings` | Read-only table of all shops' voice link visit/start stats |
| **Trial Extension** | `/admin/settings` | Extend any shop's subscription end date |
| **Audit Log** | `/admin/audit` | Full security and action trail |

---

## 5. INTEGRATIONS

| Integration | Type | Status | Notes |
|---|---|---|---|
| **Google Gemini Live** | AI — Real-time voice | ✅ Implemented | Powers all voice calls. Model selectable per shop (2.5 / 3.1 Flash Live) |
| **Google Gemini Flash Lite** | AI — Text | ✅ Implemented | Text chat widget, website extraction, transcript summarisation |
| **Supabase** | Database + Auth + Storage | ✅ Implemented | PostgreSQL + RLS + file storage for backups/avatars |
| **Google OAuth** | Auth | ✅ Implemented | Client registration/login via Supabase Google provider |
| **Google Calendar** | Integration | ✅ Implemented | Auto-creates calendar events for appointments. OAuth 2.0. Booking categories only. |
| **Resend** | Email delivery | ✅ Implemented | All transactional emails (payment, subscription, welcome, trial ending) |
| **Cloudflare** | DNS + CDN | ✅ Implemented | DNS management, DDoS protection |
| **bKash** | Payment | ✅ Implemented | Manual phone number + screenshot submission flow. BD region only. |
| **Nagad** | Payment | ✅ Implemented | Same as bKash. BD region. Currently disabled by default. |
| **Rocket** | Payment | ✅ Implemented | Same as bKash. BD region. Currently disabled by default. |
| **Paddle** | Payment | 🔶 Partial | Checkout URL redirect implemented. Webhook receiver for auto-activation NOT yet built. |
| **Asterisk PBX** | SIP Telephony | ✅ Implemented | Deployed on VPS. 2 trunks registered. Dialplan routes all calls to bridge. |
| **bridge.js** | SIP-to-AI bridge | ✅ Implemented | Audio resampling (8kHz↔24kHz), noise gate, DID matching, auto-polls telephony config. |
| **Railway** | Cloud hosting | ✅ Implemented | `web` + `enthusiastic-amazement` (voice) services in `soothing-hope` project. Now primary. |
| **Contabo VPS** | Self-hosted | ✅ Implemented | Asterisk + bridge remain here. kothabot-web + kothabot-voice being migrated off. |
| **PM2** | Process management | ✅ Implemented | Manages all VPS processes. |
| **Nginx** | Reverse proxy | ✅ Implemented | SSL termination, WS upgrade, buffer tuning. |
| **Let's Encrypt** | SSL | ✅ Implemented | Certbot managed. |
| **WordPress Plugin** | WooCommerce sync | 🔶 Partial | Plugin built and tested on myhealth.us. Awaiting re-upload with Elementor fix. Not in production yet. |
| **WooCommerce** | E-commerce sync | 🔶 Partial | Product sync (upsert by SKU) + order sync implemented in WP plugin. Loop prevention in place. |
| **Amelia** | Booking sync | 🔶 Partial | Outbound booking creation via filter hook (version-dependent). Not deployed. |
| **WhatsApp** | Messaging channel | 🟡 Planned | `/api/webhooks/whatsapp` not yet built |
| **Messenger** | Messaging channel | 🟡 Planned | `/api/webhooks/messenger` not yet built |
| **Telegram** | Messaging channel | 🟡 Planned | `/api/webhooks/telegram` not yet built |
| **Google Sheets** | Data export | 🟡 Planned | Not started |
| **Zapier / Make.com** | Automation | 🟡 Planned | Would use the Public API v1 |
| **Lemon Squeezy** | Payment (legacy) | ❌ Replaced | Field `ls_checkout_url` kept for backwards compat. Paddle is the replacement. |

---

## 6. DATABASE OVERVIEW

### Tables and Relationships

**Tenant Core**
```
shops (id, owner_id → auth.users, name, category, ai_config JSONB, widget_config JSONB, public_slug)
  └── orders (shop_id, customer_name, items JSONB, status, metadata JSONB)
  └── customers (shop_id, name, phone, email, metadata JSONB)
  └── products (shop_id, name, price, sku, description, metadata JSONB, active)
  └── subscriptions (shop_id, plan_id, status, current_period_end, calls_used, minutes_used)
  └── payments (shop_id, subscription_id, amount, currency, method, transaction_id, status)
```

**AI & Knowledge**
```
shops
  └── voice_sessions (shop_id, session_id, transcript, duration_seconds, end_reason, off_topic_count, order_linked, archived_at)
  └── training_data (shop_id, type, question, answer)
  └── knowledge_sources (shop_id, url, status)
      └── knowledge_chunks (source_id, shop_id, source_type, title, content, url)
```

**Integrations**
```
shops
  └── calendar_integrations (shop_id, provider, access_token, refresh_token, calendar_id)
      └── calendar_events (shop_id, order_id, google_event_id)
  └── api_keys (shop_id, key_hash, name, active, key_prefix)
      └── api_usage_logs (shop_id, endpoint, method, status_code, duration_ms)
  └── webhook_endpoints (shop_id, url, events[], secret, active)
      └── webhook_deliveries (endpoint_id, event, payload, status, response_code)
  └── voice_links (shop_id, slug, label, active)
```

**Backup & Audit**
```
shops
  └── backups (shop_id, backup_type, label, status, size_bytes)
  └── backup_logs (shop_id, type, status, message)
  └── support_tickets (shop_id, subject, status, messages JSONB, unread_admin)
  └── login_activity (shop_id, ip_address, browser, city, country, country_code)

admin_audit_log (action, target_type, target_id, details JSONB)
platform_settings (key PK, value JSONB)
```

### Important Fields

| Field | Table | Why It Matters |
|---|---|---|
| `shops.ai_config` | shops | JSONB blob containing billing_region, voip_enabled, api_access_enabled, white_label, telephony config, ai_model, language, personality |
| `shops.widget_config` | shops | JSONB blob containing primaryColor, greeting, enableVoice, enableChat, requirePhone |
| `subscriptions.status` | subscriptions | `active` / `past_due` / `cancelled` — `past_due` triggers full platform lockout |
| `subscriptions.calls_used` | subscriptions | Compared against plan `call_limit` to block voice sessions |
| `voice_sessions.order_linked` | voice_sessions | Determines retention — true = permanent, false = auto-deleted after 7 days |
| `voice_sessions.end_reason` | voice_sessions | Analytics: `completed`, `inactivity`, `off_topic_limit`, `plan_limit` |
| `knowledge_chunks.source_type` | knowledge_chunks | `website` (extracted) vs `wordpress` (pushed by WP plugin via API) |
| `platform_settings.key` | platform_settings | `plans`, `payment_methods`, `global_ai_rules`, `category_prompts`, `sip_ips`, `enabled_categories` |

---

## 7. CATEGORY SYSTEM

### Clinic / Healthcare

- **Menus:** Products → "Treatments", Orders → "Appointments", Customers → "Patients"
- **Forms:** Product fields include treatment type, duration, prescription flag
- **Workflow:** AI collects patient name, symptoms, preferred doctor, appointment date/time
- **Special Logic:** Google Calendar integration shown; booking icon (Calendar) on Orders tab; appointment auto-creates calendar event

### Pharmacy

- **Menus:** Products → "Medicines", Orders → "Orders", Customers → "Customers"
- **Forms:** Product fields include dosage, manufacturer, prescription_required
- **Workflow:** AI checks prescription requirement, confirms availability, takes order
- **Special Logic:** No calendar integration; regular order flow

### Salon / Spa

- **Menus:** Products → "Services", Orders → "Appointments", Customers → "Clients"
- **Forms:** Product fields include service duration, stylist assignment
- **Workflow:** AI collects service type, stylist preference, date/time
- **Special Logic:** Google Calendar integration shown; booking icon on Orders tab

### Services (Repair, Cleaning, etc.)

- **Menus:** Products → "Services", Orders → "Bookings", Customers → "Clients"
- **Forms:** Standard service fields
- **Workflow:** AI understands service need, collects location, schedules booking
- **Special Logic:** Google Calendar integration shown; booking icon on Orders tab

### Restaurant / Café

- **Menus:** Products → "Menu Items", Orders → "Orders", Customers → "Customers"
- **Forms:** Product fields include cuisine type, dietary tags (vegetarian, halal, etc.), portion size
- **Workflow:** AI takes food/drink order, notes dietary restrictions, asks delivery vs dine-in
- **Special Logic:** No calendar; order-centric flow

### Grocery

- **Menus:** Products → "Products", Orders → "Orders", Customers → "Customers"
- **Forms:** Standard product fields, quantity
- **Workflow:** AI helps build grocery list, confirms availability, delivery/pickup preference
- **Special Logic:** Standard retail flow

### Retail / Shop

- **Menus:** Products → "Products", Orders → "Orders", Customers → "Customers"
- **Forms:** Standard product/SKU fields
- **Workflow:** AI helps find products, checks availability, processes order
- **Special Logic:** WooCommerce sync via WordPress plugin (upsert by SKU)

### Real Estate

- **Menus:** Products → "Properties", Orders → "Viewings", Customers → "Clients"
- **Forms:** Product fields include property_type, bedrooms, bathrooms, area_sqft, location
- **Workflow:** AI qualifies buyer/renter, collects requirements, books viewings
- **Special Logic:** No calendar yet; complex lead qualification flow

### Education

- **Menus:** Products → "Courses", Orders → "Enrollments", Customers → "Students"
- **Forms:** Product fields include subject, grade_level, duration, batch_size
- **Workflow:** AI explains courses, collects enrollment info, schedules trial class
- **Special Logic:** Standard booking flow adapted for enrollment

### Creative Agency

- **Menus:** Products → "Services", Orders → "Projects", Customers → "Clients"
- **Forms:** Service fields include project_type, deliverables, timeline
- **Workflow:** AI understands project scope, collects brief, schedules discovery call
- **Special Logic:** Standard service flow

### Other

- **Menus:** Products → "Products", Orders → "Orders", Customers → "Customers"
- **Forms:** Generic fields only
- **Workflow:** General AI order/inquiry handling
- **Special Logic:** None — fallback category

---

## 8. BILLING SYSTEM

### Plans

Configured in `platform_settings['plans']`. Defaults:

| Plan | BDT Price | USD Price | Calls/Period | Period | Features |
|---|---|---|---|---|---|
| Trial | Free | Free | 100 | 14 days | 100 calls, 1 widget, all AI models, email support |
| Starter | ৳999/mo | $9.99/mo | 500 | 30 days | 500 calls, priority support, analytics |
| Pro | ৳2,499/mo | $24.99/mo | 2,000 | 30 days | 2,000 calls, 3 widgets, custom voice, API access |
| Business | ৳5,999/mo | $59.99/mo | Unlimited | 30 days | Unlimited calls, white label, SLA, all features |

All prices, limits, and feature lists are fully editable from admin settings. No code change required.

### Trials

- New accounts automatically start on the Trial plan (14 days)
- Trial call limit: 100 calls (configurable)
- God admin can extend any trial via Settings → "Extend / Override Subscriptions"
- When trial expires and no payment received: `subscriptions.status = 'past_due'`

### Payment Flow — Bangladesh (BD)

1. Client selects plan → PaymentModal opens
2. If >1 enabled BD method: method selection step (bKash / Nagad / Rocket)
3. Payment step: admin-configured phone number + optional QR shown
4. Client pays externally, enters transaction ID
5. `POST /api/billing/submit-payment` → `payment_requests` row with `status=pending`
6. Admin reviews at `/admin/payments` → Confirm or Reject
7. On Confirm: subscription record updated, client access restored immediately

### Payment Flow — Global (INTL)

1. Client selects plan → PaymentModal opens
2. Single step: redirects to Paddle checkout URL (configured per plan)
3. Paddle handles card processing
4. ⚠️ Paddle webhook receiver not yet built → admin must manually confirm until implemented

### Subscription Lockout

When `subscriptions.status = 'past_due'`:
- Dashboard layout detects this → all routes redirect to `/billing`
- Widget shows padlock screen → no AI access for their customers
- `GET /api/voice/check-limit` returns 403 → voice calls blocked
- All `/api/v1/*` routes return 402 → API access blocked

Recovery: Admin confirms payment → status set to `active` → instant unblock.

### Usage Limits

Per billing period, tracked in `subscriptions`:
- `calls_used` — incremented on each voice session start
- `minutes_used` — tracked in seconds via voice server
- `extra_calls` — bonus calls added by admin
- `extra_minutes` — bonus minutes added by admin

Admin can reset counters and add extra quota from `/admin/shops/[shopId]` → Usage Limits panel.

### Call Duration Caps (per plan)

Enforced by voice server via `/api/voice/check-limit`:

| Plan | Max Call Duration |
|---|---|
| Trial | 3 minutes (180s) |
| Starter | 5 minutes (300s) |
| Pro | 8 minutes (480s) |
| Business | 12 minutes (720s) |

---

## 9. VOICE SYSTEM

### Voice Widget

- Merchant embeds `public/embed.js` via a `<script>` tag
- Script injects a floating bubble (bottom-right) onto the merchant's website
- On click: full-screen `<iframe>` loads `/widget/{shopId}?mode=voice&autostart=1`
- `autostart=1` fires `startCall()` on mount — no second tap needed
- Widget connects via WebSocket to `NEXT_PUBLIC_VOICE_SERVER_URL` (wss://)
- Voice + text chat mode toggling available in widget

### Voice Links

- Public shareable pages at `{NEXT_PUBLIC_VOICE_LINK_URL}/v/{slug}`
- Managed by client at `/voice-links`
- Stats (visits, voice starts) visible to admin in Settings
- Admin can enable/disable per shop's `public_access_enabled` flag
- Visit events tracked in `public_link_visits` table

### Call Flow (Widget)

```
Browser → /widget/{shopId} (iframe)
  → Widget fetches shop config
  → On call start: GET /api/voice/check-limit (usage check + plan duration cap)
  → WebSocket connects to Voice Server
  → Voice Server: loadSessionConfig() from web API
  → Voice Server: buildSystemInstruction() (4 layers)
  → Voice Server: startLiveSession() with Gemini Live API
  → Bidirectional audio stream (browser mic ↔ Gemini ↔ browser speaker)
  → On end/timeout: POST /api/voice/save-session (transcript + order extraction)
```

### Call Flow (SIP Phone)

```
Phone → SIP Provider → Asterisk PBX (:5060)
  → extensions.conf: Audiosocket(DID_UUID, 127.0.0.1:9092)
  → bridge.js (TCP :9092)
    → 8kHz G.711 → 24kHz PCM upsample + noise gate
    → WebSocket → Voice Server (:8080)
  → Same Gemini Live session lifecycle as widget
  → Response audio: 24kHz → 8kHz downsample → Asterisk → Phone
```

### Knowledge Base (AI Context)

`buildTrainingData()` in `lib/widget-training.ts` assembles:
1. Knowledge chunks from website extraction (`source_type='website'`)
2. Knowledge chunks pushed by WordPress plugin (`source_type='wordpress'`)
3. Manual training data (FAQ / info / policy from `training_data` table)
4. Active product/service catalog (name, price, description)

Result is a single text block injected as the bottom of Layer 4.

### Prompt Layers

| Layer | Source | Scope |
|---|---|---|
| Layer 1 — Global Rules | `platform_settings['global_ai_rules']` | All shops, all sessions |
| Layer 2 — Business Profile | `shops.ai_config.systemPrompt`, name, language | This shop only |
| Layer 3 — Category Rules | `platform_settings['category_prompts'][category]` | This category only |
| Layer 4 — Knowledge Base | `buildTrainingData()` output | This shop's data |
| White-Label Injection | `ai_config.white_label = true` | This shop only — prepended before all layers |

### AI Rules (Admin Configurable)

- **Global AI Rules (Layer 1):** Edited at `/admin/settings` → Global AI Rules. Injected into every session on every shop.
- **Category Prompts (Layer 3):** Edited at `/admin/settings` → Category Prompts. Per-category order/booking collection instructions.
- **White-Label:** When enabled for a shop, the AI identifies as the business's own assistant and never mentions KothaBot, Gemini, or Google.

### Session Lifecycle

- **90-second chunking:** Long calls chunk every 90s. New Gemini session starts with a 3-sentence summary of the previous chunk. No greeting replay on chunk switch.
- **Inactivity timeout:** 40 seconds of silence ends the session. `end_reason = 'inactivity'`
- **Off-topic limit:** 3 off-topic violations detected from AI refusal phrases → session ends. `end_reason = 'off_topic_limit'`
- **Plan cap:** Duration cap reached → session ends. `end_reason = 'plan_limit'`
- **Farewell detection:** AI says goodbye → graceful end. `end_reason = 'completed'`

---

## 10. NAVIGATION AUDIT

### Current Admin Navigation Issues

| Issue | Detail | Severity |
|---|---|---|
| **Flat header nav — no hierarchy** | All 10 menu items sit as small icon-buttons in the top bar. No grouping. Hard to scan on mobile. | High |
| **"Pay" and "Billing" are inconsistent labels** | Admin menu says "Pay" but it's a payment request review system. Should be "Payments". | Medium |
| **"Help" is ambiguous** | The menu is actually a full support ticket system. "Support" is clearer. | Medium |
| **"Emails" is underused** | Only previews email templates. Cannot send emails. Easy to confuse with "outbox". | Medium |
| **"API" and "Calendar" are operational monitors** | These belong in a monitoring/integrations group, not top-level nav. | Low |
| **Settings page is extremely long** | 9 distinct sections on one scrolling page (payments, SIP, categories, plans, voice, prompts, AI rules, voice links, trial extensions). Should be split. | High |
| **No dedicated "Clients" menu** | Client management happens via the dashboard page. Should have its own clear entry point. | Medium |
| **Audit is at the end of nav** | Security-critical page buried last. | Low |
| **No back-to-admin link from Settings** | Settings has a back arrow but no breadcrumb showing "Admin → Settings". | Low |

### Duplicate / Redundant Areas

| Overlap | Detail |
|---|---|
| Support tickets appear in both `/admin/support` (all) AND `/admin/shops/[shopId]` (per-shop) | Good duplication — contextual; not a problem |
| Knowledge visible in `/admin/knowledge` (all shops) AND in each client's `/training` page | Different scopes — both needed |
| Voice Links stats in `/admin/settings` AND client's `/voice-links` | Admin view is read-only stats; no redundancy |

### Menus That Could Be Grouped

**Operations group:** Payments, Support  
**Monitoring group:** API, Calendar, Knowledge, Backups  
**Configuration group:** Settings (split into: Plans & Billing, AI & Prompts, Integrations, Categories)  
**Security group:** Audit

### Recommended Master Admin Structure

```
Master Admin
├── Dashboard          (overview stats + client list)
│
├── OPERATIONS
│   ├── Clients        (was: Dashboard client list → dedicated page)
│   ├── Payments       (was: "Pay")
│   └── Support        (was: "Help")
│
├── MONITORING
│   ├── API Usage      (was: "API")
│   ├── Calendars      (was: "Calendar")
│   ├── Knowledge      (was: "Knowledge")
│   └── Backups        (was: "Backups")
│
├── CONFIGURATION
│   ├── Plans & Billing    (plans, payment methods, trial extensions)
│   ├── AI & Prompts       (global rules, category prompts, voice protection)
│   ├── Categories         (enabled categories for signup)
│   ├── Voice Links        (public link stats)
│   └── Telephony / SIP    (SIP provider IPs)
│
├── COMMUNICATIONS
│   └── Email Templates    (was: "Emails")
│
└── SECURITY
    └── Audit Log          (was: "Audit")
```

---

## 11. FUTURE MODULES

Discovered from codebase comments, CLAUDE.md, and CHANGELOG.md:

| Module | Source of Discovery | Status | Notes |
|---|---|---|---|
| **WhatsApp Webhook** | CLAUDE.md pending list | 🟡 Planned | Route: `/api/webhooks/whatsapp` |
| **Messenger Webhook** | CLAUDE.md pending list | 🟡 Planned | Route: `/api/webhooks/messenger` |
| **Telegram Webhook** | CLAUDE.md pending list | 🟡 Planned | Route: `/api/webhooks/telegram` |
| **Google Sheets Integration** | CLAUDE.md pending list | 🟡 Planned | Data export |
| **Paddle Webhook Receiver** | Billing system gap | 🟡 Planned | Auto-activate INTL subscriptions |
| **Email Verification** | CLAUDE.md pending list | 🟡 Planned | For new signups |
| **Webhook Delivery Retry** | CLAUDE.md known issues | 🟡 Open | Currently fire-and-forget |
| **Redis Rate Limiter** | CLAUDE.md known issues | 🟡 Open | Replace in-memory rate limiter for multi-instance |
| **UFW Firewall** | CLAUDE.md known issues | 🟡 Open | VPS firewall not yet enabled |
| **Amelia (WP) Booking Sync** | WordPress plugin | 🔶 Partial | Outbound best-effort via filter hook |
| **WooCommerce Full Sync** | WordPress plugin | 🔶 Partial | Plugin built, not yet in production on myhealth.us |
| **Google Calendar OAuth Verification** | CLAUDE.md | 🔶 Open | App not yet verified by Google |
| **Multi-Instance PM2 / Redis** | Perf audit | 🟡 Open | Rate limiter breaks at >1 PM2 instance |
| **Documentation Portal** | `kothabot.ai.bd/docs` | 🔶 External | Referenced throughout codebase; separate site |

---

## 12. FINAL RECOMMENDATIONS

### Proposed Master Admin Group Structure

Every existing module placed into the recommended five groups:

---

### GROUP 1 — OPERATIONS

> Day-to-day running of the platform. High-urgency items that need daily attention.

| Module | Current Location |
|---|---|
| Client List & Registration Stats | `/admin` (dashboard) |
| Per-Shop Management | `/admin/shops/[shopId]` |
| Payment Review & Approval | `/admin/payments` |
| Support Ticket Inbox | `/admin/support` |
| Trial Extension & Plan Override | `/admin/settings` (bottom) |

**Recommended nav:** Dashboard → Clients → Payments → Support

---

### GROUP 2 — AI PLATFORM

> Configuration that directly controls how the AI behaves across all shops.

| Module | Current Location |
|---|---|
| Global AI Rules (Layer 1) | `/admin/settings` |
| Category Prompts (Layer 3) | `/admin/settings` |
| AI Model per Shop | `/admin/shops/[shopId]` |
| White-Label Feature Flag | `/admin/shops/[shopId]` |
| Voice Protection (in-app browser) | `/admin/settings` |
| Signup Categories | `/admin/settings` |

**Recommended nav:** AI Config → Category Prompts → Voice Settings

---

### GROUP 3 — COMMUNICATIONS

> All outbound communication channels.

| Module | Current Location |
|---|---|
| Email Templates | `/admin/emails` |
| WhatsApp Webhook (planned) | Not yet built |
| Messenger Webhook (planned) | Not yet built |
| Telegram Webhook (planned) | Not yet built |
| Support Ticket System | `/admin/support` |

**Recommended nav:** Emails → Channels (WhatsApp / Messenger / Telegram when built)

---

### GROUP 4 — INTEGRATIONS

> Third-party connections and platform-level integration monitoring.

| Module | Current Location |
|---|---|
| Google Calendar Monitor | `/admin/calendar` |
| API Key Monitor & Usage Logs | `/admin/api` |
| SIP Provider IP Whitelist | `/admin/settings` |
| VoIP Feature Flag per Shop | `/admin/shops/[shopId]` |
| API Access Feature Flag per Shop | `/admin/shops/[shopId]` |
| Payment Methods Configuration | `/admin/settings` |
| Public Voice Links Stats | `/admin/settings` |
| WordPress Plugin (future admin view) | Not yet built |

**Recommended nav:** Calendar → API → Telephony → Payment Methods → Voice Links

---

### GROUP 5 — ANALYTICS

> Read-only reporting and monitoring.

| Module | Current Location |
|---|---|
| Platform Stats (clients, orders, calls) | `/admin` dashboard header |
| Regional Split (BD/Global/Unassigned) | `/admin` dashboard |
| Voice Link Visit / Start Stats | `/admin/settings` |
| Knowledge Base Overview | `/admin/knowledge` |
| API Usage Analytics | `/admin/api` |
| Backup Dashboard | `/admin/backups` |
| Login Activity (per shop) | `/admin/shops/[shopId]` |

**Recommended nav:** Overview → Voice → Knowledge → Backups

---

### GROUP 6 — SYSTEM

> Security, compliance, and infrastructure configuration.

| Module | Current Location |
|---|---|
| Audit Log | `/admin/audit` |
| Subscription Plans Editor | `/admin/settings` |
| Billing Region Override | `/admin/shops/[shopId]` |
| Category Override (admin-locked) | `/admin/shops/[shopId]` |
| Shop Deletion (Danger Zone) | `/admin/shops/[shopId]` |
| Platform Settings (all) | `/admin/settings` |

**Recommended nav:** Audit → Platform Config → Danger Operations

---

### Summary Priority Actions

| Priority | Action | Effort |
|---|---|---|
| 🔴 High | Split Settings page into 4-5 grouped sub-pages | Medium |
| 🔴 High | Replace flat header icon-buttons with a proper sidebar nav | Medium |
| 🟡 Medium | Rename "Pay" → "Payments", "Help" → "Support" | Low |
| 🟡 Medium | Move Client List to its own `/admin/clients` route | Low |
| 🟡 Medium | Group Settings into: Plans, AI Config, Integrations, Categories, Voice | Medium |
| 🟢 Low | Add breadcrumbs to all admin sub-pages | Low |
| 🟢 Low | Move Audit Log to a more prominent position | Low |
| 🟢 Low | Add quick-action buttons on Dashboard (e.g. "Review 3 pending payments") | Low |
