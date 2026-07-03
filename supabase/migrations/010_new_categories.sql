-- ============================================================
-- KothaBot v2.0 — New Business Categories
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add new category enum values (safe — only adds, never removes)
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'real_estate';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'education';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'creative_agency';
