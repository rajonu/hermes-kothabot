-- ─── Fix subscriptions table to match KothaBot v2 payment system ────────────
-- Run this in Supabase SQL Editor

-- 1. Add plan_id text column (flexible plan names: trial/starter/pro/business)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'trial';

-- 2. Add unique constraint on shop_id (one subscription per shop)
--    Drop existing index first, then add unique constraint
DROP INDEX IF EXISTS idx_subscriptions_shop_id;
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_shop_id_unique;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_shop_id_unique UNIQUE (shop_id);

-- 3. Add payment_provider text column (replaces restricted enum)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'manual';

-- 4. Sync plan_id from existing plan enum for existing rows
UPDATE public.subscriptions SET plan_id = 'trial' WHERE plan_id = 'trial';

-- 5. Recreate index
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON public.subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
