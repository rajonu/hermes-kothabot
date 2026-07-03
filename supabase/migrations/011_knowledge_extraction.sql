-- ============================================================
-- KothaBot v2.0 — Knowledge Extraction Engine
-- Run this in Supabase SQL Editor
-- ============================================================

-- Tracks extraction attempts per shop (enforces one-time limit)
create table public.knowledge_sources (
  id                uuid primary key default uuid_generate_v4(),
  shop_id           uuid not null references public.shops(id) on delete cascade,
  website_url       text,
  facebook_url      text,
  extraction_status text not null default 'pending', -- pending | processing | completed | failed | partial
  extracted_at      timestamptz,
  extracted_by      text not null default 'system',  -- system | admin
  error_message     text,
  website_status    text,   -- completed | failed | skipped
  facebook_status   text,   -- completed | failed | skipped
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Structured AI-optimized knowledge chunks
create table public.knowledge_chunks (
  id           uuid primary key default uuid_generate_v4(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  source_type  text not null,   -- website | facebook
  chunk_type   text not null,   -- business_summary | full
  content      text not null,
  word_count   integer,
  created_at   timestamptz not null default now()
);

-- Indexes
create index idx_knowledge_sources_shop_id on public.knowledge_sources(shop_id);
create index idx_knowledge_chunks_shop_id  on public.knowledge_chunks(shop_id);

-- RLS
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks  enable row level security;

create policy "shop_owner_knowledge_sources" on public.knowledge_sources
  for all using (
    exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
  );

create policy "shop_owner_knowledge_chunks" on public.knowledge_chunks
  for all using (
    exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
  );
