-- ─── ADMIN AUDIT LOG ─────────────────────────────────────────────────────────
-- Records every admin action with full details for accountability.
create table if not exists public.admin_audit_log (
  id           uuid primary key default uuid_generate_v4(),
  admin_email  text not null,
  action       text not null,       -- e.g. 'approve_payment', 'update_plan', 'extend_trial'
  target_type  text,                -- e.g. 'shop', 'payment_request', 'platform_settings'
  target_id    text,                -- ID of the thing that was changed
  details      jsonb,               -- before/after or summary
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index idx_audit_admin_email  on public.admin_audit_log(admin_email);
create index idx_audit_created_at   on public.admin_audit_log(created_at desc);
create index idx_audit_action       on public.admin_audit_log(action);

-- No public access — admin only via service key
alter table public.admin_audit_log enable row level security;
-- No policies — only accessible via createAdminClient()
