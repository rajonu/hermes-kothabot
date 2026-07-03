-- 017_performance_indexes.sql
-- Performance audit 2026-06-10: migration 001 created no indexes on the
-- hottest multi-tenant tables, so every dashboard query was a sequential scan.
-- All indexes use IF NOT EXISTS — safe to run multiple times.

-- Orders: dashboard lists, recent orders, status filters
CREATE INDEX IF NOT EXISTS idx_orders_shop_created
  ON public.orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status
  ON public.orders (shop_id, status);

-- Customers: customer lists + counts
CREATE INDEX IF NOT EXISTS idx_customers_shop
  ON public.customers (shop_id);

-- Voice sessions: analytics, transcripts, daily call counts
CREATE INDEX IF NOT EXISTS idx_voice_sessions_shop_created
  ON public.voice_sessions (shop_id, created_at DESC);

-- Training data + knowledge chunks: loaded by dashboard layout / widget context
CREATE INDEX IF NOT EXISTS idx_training_data_shop
  ON public.training_data (shop_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_shop
  ON public.knowledge_chunks (shop_id);

-- Shops: looked up by owner on every authenticated page load
CREATE INDEX IF NOT EXISTS idx_shops_owner
  ON public.shops (owner_id);
