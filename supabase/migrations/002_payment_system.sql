-- ─── PAYMENT REQUESTS ─────────────────────────────────────────────────────────
-- Merchants submit payment proof here. Admin approves/rejects.
create table if not exists public.payment_requests (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  plan_id         text not null,
  amount          integer not null,
  method          text not null check (method in ('bkash','nagad','rocket','card','other')),
  phone_last4     text not null,
  transaction_id  text not null,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_payment_requests_shop_id on public.payment_requests(shop_id);
create index idx_payment_requests_status  on public.payment_requests(status);

-- RLS: merchants can see their own requests; admins handled via service key
alter table public.payment_requests enable row level security;

create policy "merchants_read_own_payments" on public.payment_requests
  for select using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

create policy "merchants_insert_own_payments" on public.payment_requests
  for insert with check (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );

-- ─── PLATFORM SETTINGS ────────────────────────────────────────────────────────
-- Admin-configurable key/value store. All payment settings, plan configs, etc.
create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- No public access — only via service role key (admin client)
alter table public.platform_settings enable row level security;
-- No public policies — admin uses createAdminClient() which bypasses RLS

-- ─── SEED DEFAULT SETTINGS ────────────────────────────────────────────────────
insert into public.platform_settings (key, value) values

-- Payment method phone numbers + QR codes
('payment_methods', '{
  "bkash":  {"number": "01XXXXXXXXX", "qr_url": null, "enabled": true},
  "nagad":  {"number": "01XXXXXXXXX", "qr_url": null, "enabled": true},
  "rocket": {"number": "01XXXXXXXXX", "qr_url": null, "enabled": true}
}'::jsonb),

-- Subscription plan definitions (prices, features, limits)
('plans', '{
  "trial":    {"name":"Trial",    "price":0,    "currency":"BDT","period_days":14,  "call_limit":100,  "features":["100 calls/month","1 widget","All AI models","Email support"]},
  "starter":  {"name":"Starter",  "price":999,  "currency":"BDT","period_days":30,  "call_limit":500,  "features":["500 calls/month","1 widget","All AI models","Priority support","Analytics"]},
  "pro":      {"name":"Pro",      "price":2499, "currency":"BDT","period_days":30,  "call_limit":2000, "features":["2,000 calls/month","3 widgets","Custom voice","Dedicated support","Analytics","API access"]},
  "business": {"name":"Business", "price":5999, "currency":"BDT","period_days":30,  "call_limit":-1,   "features":["Unlimited calls","Unlimited widgets","White label","SLA guarantee","All Pro features","Custom integrations"]}
}'::jsonb),

-- Notification settings
('notifications', '{
  "email": "pay@kothabot.ai",
  "payment_notify": true
}'::jsonb)

on conflict (key) do nothing;

-- ─── TRIGGER: update updated_at ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger payment_requests_updated_at
  before update on public.payment_requests
  for each row execute function public.set_updated_at();

create trigger platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();
