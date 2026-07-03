-- ============================================================
-- KothaBot v2.0 — Backup & Restore System
-- Run this in Supabase SQL Editor
-- ============================================================

-- Main backups table
create table public.backups (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         uuid references public.shops(id) on delete cascade,  -- NULL = platform backup
  backup_type     text not null,  -- manual | daily | weekly | pre_restore | platform
  created_by      text not null default 'system',  -- system | admin | user
  status          text not null default 'completed', -- completed | failed | in_progress
  size_bytes      integer,
  data            jsonb,          -- full backup payload
  label           text,           -- optional user label
  created_at      timestamptz not null default now()
);

-- Immutable audit log (clients cannot delete)
create table public.backup_logs (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     uuid references public.shops(id) on delete set null,
  backup_id   uuid references public.backups(id) on delete set null,
  action      text not null,  -- created | restored | deleted | failed | pre_restore_created
  backup_type text,
  performed_by text not null default 'system',  -- system | admin | user:<id>
  ip_address  text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Indexes
create index idx_backups_shop_id    on public.backups(shop_id);
create index idx_backups_type       on public.backups(backup_type);
create index idx_backups_created_at on public.backups(created_at desc);
create index idx_backup_logs_shop   on public.backup_logs(shop_id);

-- RLS
alter table public.backups      enable row level security;
alter table public.backup_logs  enable row level security;

-- Clients: read/create their own backups only
create policy "client_read_own_backups" on public.backups
  for select using (
    shop_id is not null and
    exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
  );

create policy "client_insert_own_backups" on public.backups
  for insert with check (
    shop_id is not null and
    exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
  );

-- Clients can read their own audit logs
create policy "client_read_own_backup_logs" on public.backup_logs
  for select using (
    shop_id is not null and
    exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
  );
