-- ─────────────────────────────────────────────────────────────
-- 018: Leads (phone-gate before voice/chat starts)
-- Captures every phone number that enters the widget — even if
-- the user never orders. Lets shop owners follow up on dropped
-- sessions and protects against spam by requiring a phone first.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  phone           text not null,
  country         text,                          -- 'BD', 'US', etc. (ISO-2)
  name            text,                          -- filled when order/booking happens
  source          text not null default 'widget',-- 'widget_voice', 'widget_chat', 'phone_sip'
  session_id      uuid,                          -- link to voice_sessions if any
  has_ordered     boolean not null default false,
  has_booked      boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_leads_shop_id on public.leads(shop_id);
create index if not exists idx_leads_phone on public.leads(phone);
create index if not exists idx_leads_created on public.leads(created_at desc);
create unique index if not exists uq_leads_shop_phone on public.leads(shop_id, phone);

alter table public.leads enable row level security;

-- Shops can read their own leads
create policy "shop_owners_read_leads"
  on public.leads for select
  using (shop_id in (select id from public.shops where owner_id = auth.uid()));

-- Service role (widget API) can insert/update via service key — no policy needed for that.
