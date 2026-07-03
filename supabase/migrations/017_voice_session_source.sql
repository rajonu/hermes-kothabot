-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017 — Voice session source tracking
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds two columns to voice_sessions:
--   - source     text  default 'widget'  → 'widget' | 'voice_link' | 'phone'
--   - caller_did text  nullable          → original DID for phone-call sessions
--
-- Why: phone-call transcripts were never saved before. The voice-server now
-- writes phone sessions directly via /api/voice/save-session. The source field
-- lets the dashboard label each transcript ("📞 IP Phone", "🌐 Widget", etc.).
--
-- Safe to apply: defaults backfill existing rows; no breaking changes.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.voice_sessions
  add column if not exists source     text default 'widget' not null,
  add column if not exists caller_did text;

create index if not exists idx_voice_sessions_source on public.voice_sessions(source);
