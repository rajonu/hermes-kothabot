-- Migration 016: Transcript retention policy
-- Adds retention fields to voice_sessions for tiered transcript archival:
-- - order_linked = true → keep forever
-- - order_linked = false → auto-delete after 7 days

ALTER TABLE public.voice_sessions
  ADD COLUMN IF NOT EXISTS order_linked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Index for retention queries (find sessions ready to be cleaned up)
CREATE INDEX IF NOT EXISTS idx_voice_sessions_retention
  ON public.voice_sessions (order_linked, archived_at)
  WHERE archived_at IS NOT NULL;

-- Index for fast client transcript lookups
CREATE INDEX IF NOT EXISTS idx_voice_sessions_shop_order_linked
  ON public.voice_sessions (shop_id, order_linked, created_at DESC);
