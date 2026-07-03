-- API Keys System
-- Each shop gets test + live keys. Keys are stored hashed (SHA-256).
-- The raw key is only shown once at generation time.

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Default',
  key_prefix    TEXT NOT NULL,           -- e.g. "kb_live_abc12" (first 16 chars shown)
  key_hash      TEXT NOT NULL UNIQUE,    -- SHA-256 hex of full raw key
  type          TEXT NOT NULL CHECK (type IN ('test', 'live')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  request_count BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_shop_id_idx ON api_keys (shop_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

-- Usage logs — one row per request
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  method      TEXT NOT NULL,
  status_code INT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  duration_ms INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_usage_logs_api_key_id_idx ON api_usage_logs (api_key_id);
CREATE INDEX IF NOT EXISTS api_usage_logs_shop_id_idx    ON api_usage_logs (shop_id);
CREATE INDEX IF NOT EXISTS api_usage_logs_created_at_idx ON api_usage_logs (created_at DESC);

-- Auto-clean logs older than 90 days (run via pg_cron or periodic job)
-- SELECT cron.schedule('clean-api-logs', '0 2 * * *', $$DELETE FROM api_usage_logs WHERE created_at < NOW() - INTERVAL '90 days'$$);

-- Webhook endpoints registered by clients
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  events      TEXT[] NOT NULL DEFAULT '{}',   -- e.g. ['order.created', 'customer.created']
  secret      TEXT NOT NULL,                  -- HMAC-SHA256 signing secret
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_shop_id_idx ON webhook_endpoints (shop_id);

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         JSONB NOT NULL,
  response_status INT,
  response_body   TEXT,
  duration_ms     INT,
  success         BOOLEAN NOT NULL DEFAULT false,
  attempt         INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_shop_id_idx    ON webhook_deliveries (shop_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_created_at_idx ON webhook_deliveries (created_at DESC);

-- RLS: clients can only see their own keys/webhooks via service role
ALTER TABLE api_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all access to these tables uses createAdminClient()
