-- ============================================================
-- KothaBot v2.0 — Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ─── ENUMS ───────────────────────────────────────────────────
create type shop_category as enum (
  'restaurant', 'retail', 'salon', 'clinic',
  'pharmacy', 'grocery', 'services', 'other'
);
create type subscription_plan as enum ('trial', 'monthly', 'yearly');
create type subscription_status as enum ('trial', 'active', 'past_due', 'cancelled', 'paused');
create type payment_method as enum ('paddle', 'bkash');
create type voice_session_status as enum ('active', 'ended', 'failed');
create type order_type as enum ('order', 'appointment', 'lead');
create type order_status as enum ('pending', 'confirmed', 'processing', 'completed', 'cancelled');
create type ticket_status as enum ('open', 'pending', 'resolved');
create type training_source_type as enum ('website', 'facebook', 'manual', 'faq');
create type invoice_status as enum ('paid', 'pending', 'rejected');

-- ─── SHOPS (tenants) ─────────────────────────────────────────
create table public.shops (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  category      shop_category not null default 'other',
  slug          text unique not null,
  widget_config jsonb not null default '{
    "primaryColor": "#00e676",
    "position": "bottom-right",
    "greeting": "হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
    "showVoice": true,
    "showChat": true
  }'::jsonb,
  ai_config     jsonb not null default '{
    "systemPrompt": "",
    "language": "auto",
    "personality": "professional",
    "inactivityTimeoutSec": 60
  }'::jsonb,
  onboarding_done boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_shops_owner_id on public.shops(owner_id);
create index idx_shops_slug on public.shops(slug);

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────
create table public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  shop_id             uuid not null references public.shops(id) on delete cascade,
  plan                subscription_plan not null default 'trial',
  status              subscription_status not null default 'trial',
  payment_method      payment_method not null default 'paddle',
  paddle_sub_id       text,
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_subscriptions_shop_id on public.subscriptions(shop_id);

-- ─── VOICE SESSIONS ──────────────────────────────────────────
create table public.voice_sessions (
  id            uuid primary key default uuid_generate_v4(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  session_token text not null unique,
  status        voice_session_status not null default 'active',
  duration_s    int,
  caller_ip     inet,
  transcript    jsonb[] not null default '{}',
  summary       text,
  created_at    timestamptz not null default now()
);

create index idx_voice_sessions_shop_id on public.voice_sessions(shop_id);
create index idx_voice_sessions_created_at on public.voice_sessions(created_at desc);

-- ─── CUSTOMERS ───────────────────────────────────────────────
create table public.customers (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  name            text not null,
  phone           text,
  address         text,
  lifetime_value  numeric not null default 0,
  order_count     int not null default 0,
  demographics    jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index idx_customers_shop_id on public.customers(shop_id);
create index idx_customers_created_at on public.customers(created_at desc);

-- ─── ORDERS ──────────────────────────────────────────────────
create table public.orders (
  id           uuid primary key default uuid_generate_v4(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  type         order_type not null default 'order',
  items        jsonb not null default '[]',
  status       order_status not null default 'pending',
  total_amount numeric,
  session_id   uuid references public.voice_sessions(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_orders_shop_id on public.orders(shop_id);
create index idx_orders_created_at on public.orders(created_at desc);
create index idx_orders_status on public.orders(status);

-- ─── SUPPORT TICKETS ─────────────────────────────────────────
create table public.support_tickets (
  id             uuid primary key default uuid_generate_v4(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  subject        text not null,
  status         ticket_status not null default 'open',
  messages       jsonb[] not null default '{}',
  screenshot_url text,
  unread_admin   boolean not null default true,
  unread_client  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_support_tickets_shop_id on public.support_tickets(shop_id);
create index idx_support_tickets_status on public.support_tickets(status);

-- ─── TRAINING DATA ───────────────────────────────────────────
create table public.training_data (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  source_type     training_source_type not null default 'manual',
  source_url      text,
  extracted_text  text not null,
  last_scraped_at timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_training_data_shop_id on public.training_data(shop_id);

-- ─── INVOICES ────────────────────────────────────────────────
create table public.invoices (
  id            uuid primary key default uuid_generate_v4(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  amount        numeric not null,
  currency      text not null default 'BDT',
  status        invoice_status not null default 'pending',
  paddle_tx_id  text,
  bkash_tx_id   text,
  bkash_last4   text,
  created_at    timestamptz not null default now()
);

create index idx_invoices_shop_id on public.invoices(shop_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.handle_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.handle_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.shops enable row level security;
alter table public.subscriptions enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.support_tickets enable row level security;
alter table public.training_data enable row level security;
alter table public.invoices enable row level security;

-- shops: owner can read/write their own shop
create policy "shops_owner_all" on public.shops
  for all using (owner_id = auth.uid());

-- subscriptions: shop owner can read their subscription
create policy "subscriptions_owner_read" on public.subscriptions
  for select using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- voice_sessions: shop owner can read their sessions
create policy "voice_sessions_owner_all" on public.voice_sessions
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- customers: shop owner can manage their customers
create policy "customers_owner_all" on public.customers
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- orders: shop owner can manage their orders
create policy "orders_owner_all" on public.orders
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- support_tickets: shop owner can manage their tickets
create policy "support_tickets_owner_all" on public.support_tickets
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- training_data: shop owner can manage their training data
create policy "training_data_owner_all" on public.training_data
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- invoices: shop owner can read their invoices
create policy "invoices_owner_read" on public.invoices
  for select using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- ─── AUTO-CREATE SHOP ON SIGNUP ──────────────────────────────
-- (Optional: called from onboarding, not auto-triggered)
