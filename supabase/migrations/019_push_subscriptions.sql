-- PWA push notification subscriptions
-- One shop can have multiple subscriptions (owner on multiple devices)

create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  endpoint      text not null,
  keys_p256dh   text not null,
  keys_auth     text not null,
  created_at    timestamptz not null default now(),
  unique (shop_id, endpoint)
);

create index if not exists push_subscriptions_shop_id_idx on push_subscriptions(shop_id);

alter table push_subscriptions enable row level security;

-- Only the owning shop can manage its subscriptions
create policy "shop owner manages own push subs"
  on push_subscriptions
  for all
  using (
    shop_id in (
      select id from shops where owner_id = auth.uid()
    )
  );
