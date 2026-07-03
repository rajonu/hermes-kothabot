-- ─── LOGIN ACTIVITY ──────────────────────────────────────────────────────────
-- Tracks every merchant login: IP, browser, location.
create table if not exists public.login_activity (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  shop_id      uuid references public.shops(id) on delete set null,
  ip_address   text,
  user_agent   text,
  browser      text,        -- parsed: "Chrome 124 / macOS"
  city         text,
  country      text,
  country_code text,
  latitude     numeric(9,6),
  longitude    numeric(9,6),
  created_at   timestamptz not null default now()
);

create index idx_login_activity_user_id   on public.login_activity(user_id);
create index idx_login_activity_shop_id   on public.login_activity(shop_id);
create index idx_login_activity_created   on public.login_activity(created_at desc);

-- RLS: users can read their own activity; admins use service key
alter table public.login_activity enable row level security;

create policy "users_read_own_activity" on public.login_activity
  for select using (user_id = auth.uid());
