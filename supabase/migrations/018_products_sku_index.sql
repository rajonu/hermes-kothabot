-- 018_products_sku_index.sql
-- Speeds up the WordPress/WooCommerce product sync, which upserts products
-- by (shop_id, sku) on every catalog change. Without this, each upsert does a
-- sequential scan to find the existing row. Non-unique on purpose: products
-- without a SKU (null) are always inserted, never matched.

CREATE INDEX IF NOT EXISTS idx_products_shop_sku
  ON public.products (shop_id, sku)
  WHERE sku IS NOT NULL;
