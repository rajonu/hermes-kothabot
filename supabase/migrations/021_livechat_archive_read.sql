-- ─────────────────────────────────────────────────────────────
-- 021: Live Chat auto-archive + unread tracking
-- Conversations idle for 1hr get archived_at set (cron-driven).
-- last_read_at tracks when the dashboard last viewed a thread,
-- backing the "new message" dot on the Live Chat nav item.
-- ─────────────────────────────────────────────────────────────

alter table public.omni_conversations
  add column if not exists archived_at timestamptz,
  add column if not exists last_read_at timestamptz;

create index if not exists idx_omni_conversations_archived
  on public.omni_conversations(shop_id, archived_at);
