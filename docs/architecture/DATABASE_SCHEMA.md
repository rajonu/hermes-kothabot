# Database Schema

Supabase (PostgreSQL) project: `jrlfbfejeccsixnxhuwo.supabase.co`

Migrations live at `supabase/migrations/001–018_*.sql`. Run them in order in the Supabase SQL Editor.

---

## Core Tables

### `shops`

Primary tenant record. One per merchant account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK → auth.users | |
| `name` | text | Business name |
| `category` | enum | See CATEGORY_SYSTEM.md |
| `public_slug` | text unique | URL slug for public voice link |
| `ai_config` | jsonb | `systemPrompt`, `language`, `avatar`, `billing_region`, `voip_enabled`, `api_access_enabled`, `white_label`, `telephony`, `api_access_enabled` |
| `widget_config` | jsonb | `primaryColor`, `greeting`, `enableVoice`, `enableChat`, `requirePhone` |
| `created_at` | timestamptz | |

### `orders`

AI-captured orders, appointments, bookings, reservations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `customer_name` | text | |
| `customer_phone` | text | |
| `items` | jsonb | Array of ordered items |
| `total` | numeric | |
| `status` | text | `pending`, `confirmed`, `completed`, `cancelled` |
| `notes` | text | AI-extracted notes |
| `metadata` | jsonb | `appointment_time`, `wc_order_id`, `amelia_id`, source tags |
| `created_at` | timestamptz | |

**Index:** `shop_id, created_at DESC` (migration 017)

### `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `name` | text | |
| `phone` | text | |
| `email` | text | |
| `notes` | text | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |

**Index:** `shop_id, created_at DESC` (migration 017)

### `products`

Category-aware product/service catalog.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `name` | text | |
| `price` | numeric | |
| `sku` | text | For WooCommerce upsert-by-SKU |
| `category` | text | Product subcategory |
| `description` | text | |
| `metadata` | jsonb | Category-specific fields |
| `active` | boolean | |
| `created_at` | timestamptz | |

**Index:** `shop_id` (migration 017); `(shop_id, sku)` (migration 018)

---

## Voice & AI Tables

### `voice_sessions`

One row per AI voice call session (or 90-second chunk).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `session_id` | text | Shared across chunks |
| `transcript` | text | Full conversation |
| `duration_seconds` | integer | |
| `order_linked` | boolean | true = transcript kept permanently |
| `end_reason` | text | `completed`, `inactivity`, `off_topic_limit`, `plan_limit` |
| `off_topic_count` | integer | 0–3 |
| `archived_at` | timestamptz | Set when auto-deleted |
| `created_at` | timestamptz | |

**Index:** `shop_id, created_at DESC`; `order_linked, created_at` (migration 016/017)

### `training_data`

Manual AI knowledge entries.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `type` | text | `faq`, `info`, `policy` |
| `question` | text | |
| `answer` | text | |
| `created_at` | timestamptz | |

**Index:** `shop_id` (migration 017)

### `knowledge_sources`

Website URLs queued for AI extraction.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `url` | text | |
| `status` | text | `pending`, `processing`, `done`, `error` |
| `created_at` | timestamptz | |

### `knowledge_chunks`

Extracted knowledge segments from websites or WordPress.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `source_id` | uuid FK → knowledge_sources | nullable for WP chunks |
| `source_type` | text | `website`, `wordpress` |
| `title` | text | |
| `content` | text | |
| `url` | text | |
| `created_at` | timestamptz | |

**Index:** `shop_id` (migration 017)

---

## Billing Tables

### `subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `plan` | text | `trial`, `starter`, `pro`, `business` |
| `status` | text | `active`, `past_due`, `cancelled` |
| `billing_region` | text | `BD`, `INTL` |
| `started_at` | timestamptz | |
| `expires_at` | timestamptz | |
| `payment_method` | text | `bkash`, `nagad`, `rocket`, `paddle` |

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `subscription_id` | uuid FK → subscriptions | |
| `amount` | numeric | |
| `currency` | text | `BDT`, `USD` |
| `method` | text | |
| `transaction_id` | text | External txn reference |
| `status` | text | `pending`, `confirmed`, `rejected` |
| `created_at` | timestamptz | |

### `platform_settings`

Key-value store for global admin config.

| Column | Type | Notes |
|---|---|---|
| `key` | text PK | |
| `value` | jsonb | |
| `updated_at` | timestamptz | |

**Keys used:**
- `plans` — plan pricing/limits config (see BILLING_SYSTEM.md)
- `payment_methods` — enabled payment methods per region
- `sip_ips` — whitelist of SIP provider IPs for Asterisk config
- `global_ai_rules` — platform-wide AI safety rules
- `category_prompts` — per-category default AI prompts

---

## Integration Tables

### `calendar_integrations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `provider` | text | `google` |
| `access_token` | text | Encrypted |
| `refresh_token` | text | Encrypted |
| `calendar_id` | text | |
| `connected_email` | text | |
| `created_at` | timestamptz | |

### `calendar_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `order_id` | uuid FK → orders | |
| `google_event_id` | text | |
| `created_at` | timestamptz | |

### `api_keys`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `key_hash` | text | SHA-256 hashed (indexed) |
| `name` | text | User-assigned label |
| `active` | boolean | |
| `created_at` | timestamptz | |

Max 4 active keys per shop.

### `api_usage_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `endpoint` | text | |
| `method` | text | |
| `status_code` | integer | |
| `created_at` | timestamptz | |

### `webhook_endpoints`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `url` | text | |
| `events` | text[] | `order.created`, `appointment.created` |
| `secret` | text | HMAC signing secret |
| `active` | boolean | |

### `webhook_deliveries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `endpoint_id` | uuid FK → webhook_endpoints | |
| `event` | text | |
| `payload` | jsonb | |
| `status` | text | `pending`, `delivered`, `failed` |
| `response_code` | integer | |
| `created_at` | timestamptz | |

---

## Backup & Audit Tables

### `backups`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `filename` | text | Supabase Storage path |
| `size_bytes` | integer | |
| `created_at` | timestamptz | |

### `backup_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `type` | text | `manual`, `scheduled` |
| `status` | text | `success`, `error` |
| `message` | text | |
| `created_at` | timestamptz | |

### `admin_audit_log`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `action` | text | |
| `target_type` | text | `shop`, `payment`, etc. |
| `target_id` | text | |
| `details` | jsonb | |
| `created_at` | timestamptz | |

### `login_activity`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `ip_address` | text | |
| `user_agent` | text | |
| `created_at` | timestamptz | |

### `voice_links`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shop_id` | uuid FK → shops | |
| `slug` | text unique | URL path: `/v/{slug}` |
| `label` | text | Display name |
| `active` | boolean | |
| `created_at` | timestamptz | |

---

## Migration History

| File | Description |
|---|---|
| 001_initial_schema.sql | shops, orders, customers, voice_sessions, training_data |
| 002_payment_system.sql | subscriptions, payments, platform_settings |
| 003_admin_audit_log.sql | admin_audit_log |
| 004_login_activity.sql | login_activity |
| 005_fix_subscriptions.sql | Subscription fixes |
| 006_products.sql | products table |
| 007_orders_metadata.sql | metadata JSONB on orders |
| 008_public_voice_links.sql | voice_links |
| 009_usage_limits.sql | Usage limits system |
| 010_new_categories.sql | real_estate, education, creative_agency enums |
| 011_knowledge_extraction.sql | knowledge_sources, knowledge_chunks |
| 012_backup_system.sql | backups, backup_logs |
| 013_api_keys.sql | api_keys, api_usage_logs, webhook_endpoints, webhook_deliveries |
| 014_calendar_integration.sql | calendar_integrations, calendar_events |
| 015_session_analytics.sql | voice_sessions: end_reason, off_topic_count |
| 016_transcript_retention.sql | voice_sessions: order_linked, archived_at + indexes |
| 017_performance_indexes.sql | B-tree indexes on all high-query columns |
| 018_sku_index.sql | Composite (shop_id, sku) index on products |
