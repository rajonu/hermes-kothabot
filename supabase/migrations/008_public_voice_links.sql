-- Add public slug fields to shops table
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS public_access_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_page_title TEXT,
  ADD COLUMN IF NOT EXISTS public_page_description TEXT;

CREATE INDEX IF NOT EXISTS idx_shops_public_slug ON public.shops(public_slug) WHERE public_slug IS NOT NULL;

-- Analytics table for public link visits
CREATE TABLE IF NOT EXISTS public.public_link_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'visit', -- 'visit' | 'voice_start'
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plv_shop_id ON public.public_link_visits(shop_id);
CREATE INDEX IF NOT EXISTS idx_plv_created_at ON public.public_link_visits(created_at DESC);

ALTER TABLE public.public_link_visits ENABLE ROW LEVEL SECURITY;
-- Admin client bypasses RLS for analytics reads
