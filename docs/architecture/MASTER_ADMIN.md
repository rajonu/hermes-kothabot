# MASTER ADMIN — Enterprise Control Center

> KothaBot v2.0 · Build 146 · 2026-06-15
> Reorganized navigation specification. **No feature removed, no table renamed, no route broken.**
> Auth: PIN cookie session — pages gated by `app/(admin)/layout.tsx` → `getAdminSession()`; APIs gated by `requireAdminSession()`.

This document is the canonical reference for every Master Admin page in the reorganized 7-section structure. Each page lists Route, Purpose, Database Tables, APIs, Permissions, Dependencies, and Related Modules.

---

## Navigation Map

```
1. DASHBOARD     Overview · Revenue Summary · Active Clients · Active Voice Calls · AI Usage · Recent Activity · System Health
2. CLIENTS       All Clients · Client Details · Client Usage · Client Activity · Login As Client
3. BILLING       Payment Requests · Subscriptions · Plans · Revenue · Transactions
4. AI PLATFORM   Global AI Rules · Category Prompts · Knowledge Manager · AI Usage Analytics
5. INTEGRATIONS  SIP Providers · API Management · Google Calendar · WordPress Sync · WooCommerce Sync
6. OPERATIONS    Backup Manager · Email Templates · Audit Logs · Documentation
7. PLATFORM      Payment Methods · Signup Categories · Voice Settings · Public Voice Links · Platform Settings
```

> **Permissions:** Every page below requires a valid **Admin PIN session**. There is no role hierarchy inside the admin panel — it is single-tier (God Admin). "Permissions required" is listed per-page for completeness and future RBAC.

---

## 1. DASHBOARD

### 1.1 Overview
- **Route:** `/admin`
- **Purpose:** Single-glance platform health: total clients, orders, voice calls, pending payments, regional split, client list.
- **Database Tables:** `shops`, `orders`, `voice_sessions`, `payment_requests`, `support_tickets`, `login_activity`
- **APIs:** none (server component, direct `createAdminClient()` queries)
- **Permissions:** Admin PIN session
- **Dependencies:** `lib/admin.ts` (DEFAULT_MODEL), `lib/version.ts`, `getAdminSession()`
- **Related Modules:** Clients, Billing, Support

### 1.2 Revenue Summary
- **Route:** `/admin` (widget) / proposed `/admin/billing/revenue`
- **Purpose:** Total confirmed revenue, MRR, revenue by region (BD/Global), revenue by plan.
- **Database Tables:** `payments`, `subscriptions`, `payment_requests` (status='confirmed')
- **APIs:** none (aggregated server-side)
- **Permissions:** Admin PIN session
- **Dependencies:** `getPlatformSettings()` (plan prices), `platform-types.ts` (`formatPrice`)
- **Related Modules:** Billing

### 1.3 Active Clients
- **Route:** `/admin` (widget) → links to `/admin/clients`
- **Purpose:** Count + list of shops with `subscriptions.status='active'`.
- **Database Tables:** `shops`, `subscriptions`
- **APIs:** none
- **Permissions:** Admin PIN session
- **Related Modules:** Clients

### 1.4 Active Voice Calls
- **Route:** `/admin` (widget)
- **Purpose:** Voice sessions today + currently active (`voice_sessions.status='active'`).
- **Database Tables:** `voice_sessions`
- **APIs:** none
- **Permissions:** Admin PIN session
- **Related Modules:** AI Platform, Integrations (SIP)

### 1.5 AI Usage Summary
- **Route:** `/admin` (widget) / proposed `/admin/ai/usage`
- **Purpose:** Voice minutes today, total Gemini sessions, off-topic / plan-limit end reasons.
- **Database Tables:** `voice_sessions` (duration_s, end_reason, off_topic_count), `subscriptions` (minutes_used)
- **APIs:** none
- **Permissions:** Admin PIN session
- **Related Modules:** AI Platform

### 1.6 Recent Activity
- **Route:** `/admin` (widget) → `/admin/audit`
- **Purpose:** Latest admin actions + recent logins.
- **Database Tables:** `admin_audit_log`, `login_activity`
- **APIs:** none
- **Permissions:** Admin PIN session
- **Related Modules:** Operations (Audit)

### 1.7 System Health
- **Route:** `/admin` (widget) / proposed `/admin/system-health`
- **Purpose:** Live service status — Supabase, Voice Server, Gemini, SIP Provider, Calendar, Email Service. Plus VPS CPU/mem/disk/PM2/git.
- **Database Tables:** none (probes external services + reads `/proc`)
- **APIs:** **`GET /api/admin/system-stats?token=…`** (already exists — CPU/mem/disk/network/PM2/git). Health probes to be added: Supabase ping, voice-server `/health`, Gemini key check, Resend status.
- **Permissions:** Admin PIN session (UI) + `SYSTEM_STATS_TOKEN` (for the standalone HTML monitor)
- **Dependencies:** `process.env.SYSTEM_STATS_TOKEN`, `pm2 jlist`, `/var/www/kothabot` git checkout
- **Related Modules:** Operations
- **Widgets (Dashboard top row):** Total Clients · Total Revenue · Voice Minutes Today · API Requests Today · Active Subscriptions · Pending Payments

---

## 2. CLIENTS

### 2.1 All Clients
- **Route:** proposed `/admin/clients` (currently the table inside `/admin`)
- **Purpose:** Searchable, filterable list of every tenant shop.
- **Database Tables:** `shops`, `subscriptions`, `login_activity`
- **APIs:** none
- **Permissions:** Admin PIN session
- **Related Modules:** Billing, AI Platform

### 2.2 Client Details
- **Route:** `/admin/shops/[shopId]`
- **Purpose:** Full per-shop control panel.
- **Shows:** Business Name, Category, Region, Plan, Status, API usage, Voice usage, Calendar status, Knowledge entries, Last login, AI model, feature flags, recent orders/calls, support tickets, raw ai_config, danger zone.
- **Database Tables:** `shops`, `subscriptions`, `orders`, `voice_sessions`, `login_activity`, `support_tickets`, `knowledge_chunks`, `calendar_integrations`, `api_keys`, `auth.users` (owner email)
- **APIs:** `update-plan`, `extend-subscription`, `set-shop-feature`, `set-shop-region`, `set-shop-category`, `delete-shop`, `generate-access-link`, `send-password-reset`, `usage/adjust`, `usage/reset`
- **Permissions:** Admin PIN session
- **Dependencies:** `getPlatformSettings()`, `lib/admin.ts` (GEMINI_MODELS), component forms (`PlanSelector`, `RegionOverride`, `CategoryOverride`, `FeatureToggle`, `UsagePanel`, `ShopModelSelector`, `ClientAccessPanel`, `DeleteShopButton`)
- **Related Modules:** Billing, AI Platform, Integrations

### 2.3 Client Usage
- **Route:** proposed `/admin/clients/[shopId]/usage`
- **Purpose:** Per-client usage rollup (see CLIENT_USAGE.md for full metric list).
- **Database Tables:** `voice_sessions`, `subscriptions`, `api_usage_logs`, `knowledge_chunks`, `knowledge_sources`, `orders`, `customers`, `products`, `backups`, `calendar_events`
- **APIs:** `GET /api/admin/api-usage` (per-shop filter), `GET /api/admin/usage` helpers
- **Permissions:** Admin PIN session
- **Related Modules:** AI Platform, Billing
- **Status:** New aggregation view — joins existing tables only (no schema change)

### 2.4 Client Activity
- **Route:** `/admin/shops/[shopId]` (Login Activity section)
- **Purpose:** Login history with IP, browser, city, country.
- **Database Tables:** `login_activity`
- **APIs:** none
- **Permissions:** Admin PIN session
- **Related Modules:** Operations (Audit)

### 2.5 Login As Client
- **Route:** `/admin/shops/[shopId]` (Client Account Access panel)
- **Purpose:** Generate one-time magic login link or trigger password reset.
- **Database Tables:** `auth.users`
- **APIs:** `POST /api/admin/generate-access-link`, `POST /api/admin/send-password-reset`
- **Permissions:** Admin PIN session
- **Dependencies:** Supabase admin auth (`auth.admin.generateLink`)
- **Related Modules:** Clients
- **⚠️ Preserve:** This is the documented reason the admin panel uses PIN-only auth (admin can hold a client session simultaneously). Do not change.

---

## 3. BILLING

### 3.1 Payment Requests
- **Route:** `/admin/payments`
- **Purpose:** Review and confirm/reject manual payments (bKash/Nagad/Rocket). **Existing approval workflow preserved.**
- **Database Tables:** `payment_requests`, `shops`, `subscriptions`, `payments`
- **APIs:** `POST /api/admin/review-payment`
- **Permissions:** Admin PIN session
- **Dependencies:** Email (`send-payment-confirmation`), `PaymentTicket.tsx`
- **Related Modules:** Operations (Email), Clients

### 3.2 Subscriptions
- **Route:** proposed `/admin/billing/subscriptions`
- **Purpose:** All shops' subscription status, plan, expiry, lockout state.
- **Database Tables:** `subscriptions`, `shops`
- **APIs:** `POST /api/admin/update-plan`, `POST /api/admin/extend-subscription`
- **Permissions:** Admin PIN session
- **Related Modules:** Clients
- **Status:** New consolidated view (data currently in Settings → Trial Extension + per-shop)

### 3.3 Plans
- **Route:** `/admin/settings` (Plan Pricing) / proposed `/admin/billing/plans`
- **Purpose:** Edit plan name, period, call limit, BDT/USD price, Paddle URL, features.
- **Database Tables:** `platform_settings` (key='plans')
- **APIs:** `POST /api/admin/update-settings`
- **Permissions:** Admin PIN session
- **Dependencies:** `PlanSettingsForm.tsx`, `platform-types.ts`
- **Related Modules:** Platform

### 3.4 Revenue
- **Route:** proposed `/admin/billing/revenue`
- **Purpose:** Confirmed revenue rollups by period/region/plan.
- **Database Tables:** `payments`, `payment_requests`, `subscriptions`
- **APIs:** none (server aggregation)
- **Permissions:** Admin PIN session
- **Status:** New reporting view

### 3.5 Transactions
- **Route:** proposed `/admin/billing/transactions`
- **Purpose:** Full ledger of all payment records (confirmed/rejected/pending).
- **Database Tables:** `payments`, `payment_requests`
- **APIs:** none
- **Permissions:** Admin PIN session
- **Status:** New view over existing data

---

## 4. AI PLATFORM

### 4.1 Global AI Rules
- **Route:** `/admin/settings` (Global AI Rules) / proposed `/admin/ai/rules`
- **Purpose:** Layer 1 system instructions injected into ALL shops.
- **Database Tables:** `platform_settings` (key='global_ai_rules')
- **APIs:** `POST /api/admin/settings/global-ai-rules`
- **Permissions:** Admin PIN session
- **Dependencies:** `GlobalAIRulesForm.tsx`, `lib/ai-rules-default.ts`; consumed by voice-server `buildSystemInstruction()` + `/api/voice/global-rules`
- **Related Modules:** Voice System

### 4.2 Category Prompts
- **Route:** `/admin/settings` (Category Prompts) / proposed `/admin/ai/prompts`
- **Purpose:** Layer 3 per-category booking/order collection rules.
- **Database Tables:** `platform_settings` (key='category_prompts')
- **APIs:** `POST /api/admin/settings/category-prompts`, consumed via `/api/voice/category-rules`
- **Permissions:** Admin PIN session
- **Dependencies:** `CategoryPromptsForm.tsx`, `lib/prompt-layers.ts` (DEFAULT_CATEGORY_PROMPTS, ALL_CATEGORIES)
- **Related Modules:** Category System, Voice System

### 4.3 Knowledge Manager
- **Route:** `/admin/knowledge`
- **Purpose:** Cross-tenant view of all knowledge sources + chunk/word counts. **Already exists — visibility improved only.**
- **Database Tables:** `knowledge_sources`, `knowledge_chunks`, `shops`
- **APIs:** `GET/POST /api/admin/knowledge`
- **Permissions:** Admin PIN session
- **Dependencies:** `KnowledgeManagerClient.tsx`
- **Related Modules:** Knowledge Extraction, WordPress Sync

### 4.4 AI Usage Analytics
- **Route:** proposed `/admin/ai/usage`
- **Purpose:** Voice minutes, sessions, end-reason breakdown, off-topic stats across all shops.
- **Database Tables:** `voice_sessions`, `subscriptions`
- **APIs:** none (aggregation)
- **Permissions:** Admin PIN session
- **Status:** New analytics view over existing data

---

## 5. INTEGRATIONS

### 5.1 SIP Providers
- **Route:** `/admin/settings` (SIP) / proposed `/admin/integrations/sip`
- **Purpose:** Whitelist SIP provider IPs; Asterisk auto-accepts. **Existing SIP logic untouched.**
- **Database Tables:** `platform_settings` (key='sip_ips')
- **APIs:** `GET/POST /api/admin/settings/sip-ips`, consumed by bridge via `/api/voice/system-config`
- **Permissions:** Admin PIN session
- **Dependencies:** `SipSettingsForm.tsx`, Asterisk PBX, bridge.js
- **Related Modules:** Voice System (telephony)

### 5.2 API Management
- **Route:** `/admin/api`
- **Purpose:** Monitor all client API keys, 7-day usage logs, error rates.
- **Database Tables:** `api_keys`, `api_usage_logs`, `shops`
- **APIs:** `GET /api/admin/api-keys`, `GET /api/admin/api-usage`
- **Permissions:** Admin PIN session
- **Dependencies:** `AdminApiClient.tsx`, Public API v1
- **Related Modules:** Clients (per-shop API flag)

### 5.3 Google Calendar
- **Route:** `/admin/calendar`
- **Purpose:** Monitor all calendar integrations, events synced, sync errors. **Existing integration untouched.**
- **Database Tables:** `calendar_integrations`, `calendar_events`, `shops`
- **APIs:** `GET /api/admin/calendar`
- **Permissions:** Admin PIN session
- **Dependencies:** `AdminCalendarClient.tsx`, Google OAuth
- **Related Modules:** Clients

### 5.4 WordPress Sync
- **Route:** proposed `/admin/integrations/wordpress`
- **Purpose:** Monitor WordPress plugin connections + knowledge pushed via API.
- **Database Tables:** `knowledge_chunks` (source_type='wordpress'), `api_keys`, `api_usage_logs`
- **APIs:** `PUT/DELETE /api/v1/knowledge` (plugin), `GET /api/admin/api-usage`
- **Permissions:** Admin PIN session
- **Status:** New monitor view; plugin itself unchanged (🔶 not yet in production)
- **Related Modules:** AI Platform (Knowledge), API Management

### 5.5 WooCommerce Sync
- **Route:** proposed `/admin/integrations/woocommerce`
- **Purpose:** Monitor product/order sync from WooCommerce via the WP plugin.
- **Database Tables:** `products` (sku), `orders` (metadata.wc_order_id)
- **APIs:** `POST /api/v1/products` (upsert by SKU), `POST /api/v1/orders`
- **Permissions:** Admin PIN session
- **Status:** New monitor view; sync logic in WP plugin unchanged
- **Related Modules:** WordPress Sync

---

## 6. OPERATIONS

### 6.1 Backup Manager
- **Route:** `/admin/backups`
- **Purpose:** All shop backups + logs. **Already exists — organization improved only.**
- **Database Tables:** `backups`, `backup_logs`, `shops`, `subscriptions`
- **APIs:** `GET/POST /api/admin/backups`, client-side `/api/backup/*` (create/list/restore/download/delete/cron)
- **Permissions:** Admin PIN session
- **Dependencies:** `AdminBackupDashboard.tsx`, Supabase Storage, `BACKUP_CRON_SECRET`
- **Related Modules:** Clients

### 6.2 Email Templates
- **Route:** `/admin/emails`
- **Purpose:** Preview/manage transactional email templates.
- **Database Tables:** none (templates in `lib/email-templates.ts`)
- **APIs:** `GET/POST /api/admin/email-templates`, send routes under `/api/email/*`
- **Permissions:** Admin PIN session
- **Dependencies:** Resend SDK, `lib/email-templates.ts`
- **Related Modules:** Billing (payment confirmation)

### 6.3 Audit Logs
- **Route:** `/admin/audit`
- **Purpose:** Security/compliance trail of all admin actions.
- **Database Tables:** `admin_audit_log`
- **APIs:** none (logged by other routes via shared helper)
- **Permissions:** Admin PIN session
- **Logged actions:** admin_login, admin_logout, admin_pin_failed, admin_pin_locked, approve_payment, reject_payment, update_settings, extend_trial
- **Related Modules:** all

### 6.4 Documentation
- **Route:** proposed `/admin/operations/docs` → links to `/docs/architecture/*` + `kothabot.ai.bd/docs`
- **Purpose:** Central access to architecture docs and admin guides.
- **Database Tables:** none
- **APIs:** none
- **Permissions:** Admin PIN session
- **Status:** New index page (links only)

---

## 7. PLATFORM

### 7.1 Payment Methods
- **Route:** `/admin/settings` (Payment Methods) / proposed `/admin/platform/payment-methods`
- **Purpose:** Configure bKash/Nagad/Rocket numbers + QR; Paddle checkout URL; region pills.
- **Database Tables:** `platform_settings` (key='payment_methods')
- **APIs:** `POST /api/admin/update-settings`, `POST /api/admin/upload-qr`
- **Permissions:** Admin PIN session
- **Dependencies:** `PaymentSettingsForm.tsx`, `platform-types.ts` (`methodsForRegion`)
- **Related Modules:** Billing

### 7.2 Signup Categories
- **Route:** `/admin/settings` (Signup Categories) / proposed `/admin/platform/categories`
- **Purpose:** Toggle which categories appear on the registration form.
- **Database Tables:** `platform_settings` (key='enabled_categories')
- **APIs:** `POST /api/admin/set-enabled-categories`
- **Permissions:** Admin PIN session
- **Dependencies:** `CategoryToggleForm.tsx`, `lib/categories.config.ts`
- **Related Modules:** Category System

### 7.3 Voice Settings
- **Route:** `/admin/settings` (Voice Settings) / proposed `/admin/platform/voice`
- **Purpose:** In-app browser protection toggle for public voice links.
- **Database Tables:** `platform_settings` (key='inapp_browser_protection')
- **APIs:** `POST /api/admin/settings/voice-protection`
- **Permissions:** Admin PIN session
- **Dependencies:** `VoiceProtectionForm.tsx`
- **Related Modules:** Voice System

### 7.4 Public Voice Links
- **Route:** `/admin/settings` (Voice Links table) / proposed `/admin/platform/voice-links`
- **Purpose:** Read-only stats of all shops' public voice links (30-day visits/starts).
- **Database Tables:** `shops` (public_slug, public_access_enabled), `public_link_visits`
- **APIs:** none (server query); client tracking via `/api/voice-links/track`
- **Permissions:** Admin PIN session
- **Related Modules:** Voice System

### 7.5 Platform Settings
- **Route:** `/admin/settings`
- **Purpose:** Master settings hub (kept as fallback umbrella page even after sub-routes added).
- **Database Tables:** `platform_settings`
- **APIs:** `POST /api/admin/update-settings` + section-specific routes
- **Permissions:** Admin PIN session
- **Dependencies:** `getPlatformSettings()` and all settings forms
- **Related Modules:** all

---

## Preservation Guarantees

| Subsystem | Guarantee |
|---|---|
| Auth flow | PIN cookie unchanged; `getAdminSession()` / `requireAdminSession()` untouched |
| Database tables | No renames, no drops |
| Routes | Old routes redirect to new groups — never 404 |
| Billing logic | `review-payment`, `update-plan`, lockout logic untouched |
| SIP logic | `sip-ips`, bridge sync, Asterisk config untouched |
| API logic | `/api/v1/*`, API keys, usage logging untouched |
| Calendar | OAuth, sync, `calendar_*` tables untouched |
| Backup | `/api/backup/*`, Storage, cron untouched |
| Knowledge | extraction pipeline, `knowledge_*` tables untouched |
