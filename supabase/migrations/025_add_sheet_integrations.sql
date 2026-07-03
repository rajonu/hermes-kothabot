-- Create sheets_integrations table for Google Sheets integration
create table if not exists public.sheet_integrations (
  id                     uuid primary key default uuid_generate_v4(),
  shop_id                uuid not null references public.shops(id) on delete cascade,
  sheet_id               text not null,
  refresh_token          text not null, -- encrypted
  tab_name               text not null default 'Sheet1',
  columns                jsonb not null default '{}'::jsonb,
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists uq_sheet_integrations_shop_id
  on public.sheet_integrations(shop_id);

alter table public.sheet_integrations enable row level security;

create policy "shop_owners_manage_sheet_integrations"
  on public.sheet_integrations for all
  using (shop_id in (select id from public.shops where owner_id = auth.uid()));
