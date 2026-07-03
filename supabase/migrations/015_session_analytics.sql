-- Migration 015: Voice session analytics columns
-- Adds end_reason and off_topic_count to voice_sessions for cost protection analytics.

ALTER TABLE public.voice_sessions
  ADD COLUMN IF NOT EXISTS end_reason TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS off_topic_count INTEGER NOT NULL DEFAULT 0;

-- Index for analytics queries (filter by end_reason)
CREATE INDEX IF NOT EXISTS idx_voice_sessions_end_reason
  ON public.voice_sessions (end_reason);

-- Index for per-shop analytics
CREATE INDEX IF NOT EXISTS idx_voice_sessions_shop_end_reason
  ON public.voice_sessions (shop_id, end_reason);
