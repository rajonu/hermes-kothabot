# CLIENT USAGE — Per-Tenant Metrics Reference

> KothaBot v2.0 · Build 146 · 2026-06-15
> Defines every per-client usage metric, its source table/column, and how it is calculated.
> Powers the proposed **Clients → Client Usage** view (`/admin/clients/[shopId]/usage`).
> All metrics are derived from **existing tables** — no schema change required.

---

## Metric Catalog

| # | Metric | Source Table | Source Column / Calculation | Notes |
|---|---|---|---|---|
| 1 | **Voice Minutes** | `voice_sessions` | `SUM(duration_s) / 60` where `shop_id = ?` | Rounded to 1 decimal. Also mirrored in `subscriptions.minutes_used` for the current period. |
| 2 | **Voice Sessions** | `voice_sessions` | `COUNT(*)` where `shop_id = ?` | All-time. Filter by `created_at` for period views. |
| 3 | **Gemini Usage** | `voice_sessions` | `COUNT(*)` sessions + `SUM(duration_s)` (voice) | Gemini calls ≈ voice sessions + 90s chunks + text-chat turns. Chunk count not separately stored — approximate from duration / 90s. |
| 4 | **API Requests** | `api_usage_logs` | `COUNT(*)` where `shop_id = ?` | Filter `created_at >= now()-7d` for rolling view. `request_count` on `api_keys` gives per-key lifetime total. |
| 5 | **Knowledge Entries** | `knowledge_chunks` | `COUNT(*)` where `shop_id = ?` | Split by `source_type` (`website` vs `wordpress`). `SUM(word_count)` for total trained words. |
| 6 | **Website Extractions** | `knowledge_sources` | `COUNT(*)` where `shop_id = ?` AND `status='done'` | Each row = one extracted URL. `status` ∈ pending/processing/done/error. |
| 7 | **Orders** | `orders` | `COUNT(*)` where `shop_id = ?` | Filter `status` for breakdown (pending/confirmed/completed/cancelled). `SUM(total_amount)` for client revenue. |
| 8 | **Customers** | `customers` | `COUNT(*)` where `shop_id = ?` | Includes leads if captured as customers. |
| 9 | **Products** | `products` | `COUNT(*)` where `shop_id = ?` | Filter `active=true` for live catalog size. |
| 10 | **Backups** | `backups` | `COUNT(*)` where `shop_id = ?` | `SUM(size_bytes)` for storage footprint. Last backup = `MAX(created_at)`. |
| 11 | **Calendar Events** | `calendar_events` | `COUNT(*)` where `shop_id = ?` | Or `calendar_integrations.events_created` for the running counter (also `events_updated`, `events_cancelled`, `sync_errors`). |

---

## Detailed Metric Definitions

### 1. Voice Minutes
```
SELECT ROUND(SUM(duration_s) / 60.0, 1) AS voice_minutes
FROM voice_sessions
WHERE shop_id = :shopId;
```
- **Current period:** read `subscriptions.minutes_used` (reset each billing cycle).
- **Plan cap context:** compare against plan duration caps (Trial 3m, Starter 5m, Pro 8m, Business 12m per call) and `call_limit`.

### 2. Voice Sessions
```
SELECT COUNT(*) FROM voice_sessions WHERE shop_id = :shopId;
```
- Break down by `end_reason`: `completed`, `inactivity`, `off_topic_limit`, `plan_limit`.
- `off_topic_count` aggregate flags potential abuse.

### 3. Gemini Usage
- **Voice:** 1 Gemini Live session per call + 1 additional session per 90s chunk.
  - Approx Gemini sessions = `COUNT(sessions) + FLOOR(SUM(duration_s)/90)`.
- **Text:** each `/api/widget-chat` turn = 1 Gemini Flash Lite call (not currently persisted per-shop; add counter if precise billing needed).
- **Extraction:** each website extraction = 1 Gemini Flash Lite call (`knowledge_sources` rows with `status='done'`).

### 4. API Requests
```
SELECT COUNT(*) FROM api_usage_logs
WHERE shop_id = :shopId AND created_at >= now() - interval '7 days';
```
- Error rate: `COUNT(*) FILTER (WHERE status_code >= 400) / COUNT(*)`.
- Per-key lifetime: `api_keys.request_count`, `api_keys.last_used_at`.

### 5. Knowledge Entries
```
SELECT source_type, COUNT(*), SUM(word_count)
FROM knowledge_chunks
WHERE shop_id = :shopId
GROUP BY source_type;
```
- `website` = extracted via `/api/training/extract-website`.
- `wordpress` = pushed via `PUT /api/v1/knowledge` by the WP plugin.

### 6. Website Extractions
```
SELECT COUNT(*) FROM knowledge_sources
WHERE shop_id = :shopId AND status = 'done';
```
- Pending/error counts surface stuck extractions.

### 7. Orders
```
SELECT status, COUNT(*), SUM(total_amount)
FROM orders WHERE shop_id = :shopId GROUP BY status;
```
- `type` distinguishes order vs appointment vs booking (category-dependent).

### 8. Customers
```
SELECT COUNT(*) FROM customers WHERE shop_id = :shopId;
```

### 9. Products
```
SELECT COUNT(*) FILTER (WHERE active),
       COUNT(*)
FROM products WHERE shop_id = :shopId;
```

### 10. Backups
```
SELECT COUNT(*), SUM(size_bytes), MAX(created_at)
FROM backups WHERE shop_id = :shopId;
```
- `backup_type` ∈ manual/scheduled. Cross-check `backup_logs` for failures.

### 11. Calendar Events
```
SELECT events_created, events_updated, events_cancelled, sync_errors, last_sync_at
FROM calendar_integrations WHERE shop_id = :shopId;
```
- Authoritative count: `COUNT(*) FROM calendar_events WHERE shop_id = :shopId`.
- Connection status: row exists + `auto_sync=true`.

---

## Proposed Client Usage View Layout

```
Client: <Business Name>   Category · Region · Plan · Status

┌──────────────┬──────────────┬──────────────┐
│ Voice Minutes│ Voice Sessions│ Gemini Usage │
├──────────────┼──────────────┼──────────────┤
│ API Requests │ Knowledge     │ Extractions  │
├──────────────┼──────────────┼──────────────┤
│ Orders       │ Customers     │ Products     │
├──────────────┼──────────────┼──────────────┤
│ Backups      │ Calendar Evts │ Last Login   │
└──────────────┴──────────────┴──────────────┘

Usage vs Plan: [████████░░] 412 / 500 calls   38m / cap
End-reason breakdown · API error rate · Knowledge by source_type
```

---

## Data Source Summary (tables touched, read-only)

`voice_sessions` · `subscriptions` · `api_usage_logs` · `api_keys` · `knowledge_chunks` · `knowledge_sources` · `orders` · `customers` · `products` · `backups` · `backup_logs` · `calendar_integrations` · `calendar_events` · `login_activity`

> Every metric is a **read-only aggregation** of tables that already exist. Building the Client Usage view requires **no migration** and **no write paths** — purely additive query layer.

---

## Optional Future Counters (only if precise billing needed)

| Counter | Why | Where to add |
|---|---|---|
| Text chat turns per shop | `/api/widget-chat` not persisted per-shop | Increment a `chat_turns` counter on `subscriptions` |
| Gemini token usage | Exact cost attribution | Log token counts from Gemini responses into a new `ai_usage_logs` table (additive, no rename) |
| Chunk count per session | Precise Gemini session count | Add `chunk_count` column to `voice_sessions` (additive) |

> These are **optional** and out of scope for the reorganization. Listed for completeness only.
