-- ─── Phase 7: Products / Services / Inventory ────────────────────────────────
-- Run in Supabase SQL Editor

-- Flexible products table — works for all business categories:
--   restaurant  → menu items
--   retail/grocery → product inventory
--   clinic       → doctors + services + tests
--   salon        → services with duration
--   pharmacy     → medicine catalog
--   services     → generic services
--   other        → anything

CREATE TABLE IF NOT EXISTS public.products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(12, 2),
  category     TEXT,                     -- sub-category (e.g. 'starter', 'doctor', 'medicine')
  sku          TEXT,                     -- SKU / item code
  stock_qty    INTEGER,                  -- null = unlimited / not tracked
  unit         TEXT,                     -- e.g. 'piece', 'kg', 'tablet'
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  metadata     JSONB   NOT NULL DEFAULT '{}', -- category-specific extra fields
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id  ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(shop_id, category);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_products_updated_at();

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_owner_all" ON public.products
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

-- Admin can read/write all products (service role bypasses RLS already)
