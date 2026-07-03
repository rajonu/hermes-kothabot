-- Google Calendar Integration
-- Stores OAuth tokens per shop + tracks every synced event

CREATE TABLE IF NOT EXISTS calendar_integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  google_email     TEXT NOT NULL,
  calendar_id      TEXT NOT NULL DEFAULT 'primary',
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expiry     TIMESTAMPTZ,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at     TIMESTAMPTZ,
  -- per-shop sync settings
  auto_sync        BOOLEAN NOT NULL DEFAULT true,
  sync_updates     BOOLEAN NOT NULL DEFAULT true,
  sync_cancels     BOOLEAN NOT NULL DEFAULT true,
  -- stats
  events_created   INT NOT NULL DEFAULT 0,
  events_updated   INT NOT NULL DEFAULT 0,
  events_cancelled INT NOT NULL DEFAULT 0,
  sync_errors      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS calendar_integrations_shop_id_idx ON calendar_integrations (shop_id);

-- One row per synced order → Google Calendar event
CREATE TABLE IF NOT EXISTS calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  calendar_id     TEXT NOT NULL DEFAULT 'primary',
  sync_status     TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced','failed','cancelled')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_order_id_idx ON calendar_events (order_id);
CREATE INDEX IF NOT EXISTS calendar_events_shop_id_idx ON calendar_events (shop_id);

ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events        ENABLE ROW LEVEL SECURITY;
-- All access goes through service role (admin client) — RLS blocks direct anon access
