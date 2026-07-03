-- ─────────────────────────────────────────────────────────────
-- 020: Omnichannel (Facebook Messenger + WhatsApp) + Live Chat
-- New channel connections, conversations, and the message log
-- that backs the live-chat dashboard + Realtime feed + the
-- WhatsApp phone-takeover detector.
-- ─────────────────────────────────────────────────────────────

create type channel_type as enum ('facebook', 'whatsapp');

create table if not exists public.clients_channels (
  id                     uuid primary key default uuid_generate_v4(),
  shop_id                uuid not null references public.shops(id) on delete cascade,
  channel_type           channel_type not null,
  fb_page_id             text,
  fb_page_access_token   text,                    -- encrypted (AES-256-GCM)
  fb_page_name           text,
  wa_session_data        jsonb,                   -- encrypted Baileys auth state
  wa_phone               text,
  is_active              boolean not null default true,
  connected_at           timestamptz,
  last_error             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists uq_clients_channels_shop_channel
  on public.clients_channels(shop_id, channel_type);
create index if not exists idx_clients_channels_shop_id
  on public.clients_channels(shop_id);

create table if not exists public.omni_conversations (
  id                     uuid primary key default uuid_generate_v4(),
  shop_id                uuid not null references public.shops(id) on delete cascade,
  platform               channel_type not null,
  customer_external_id   text not null,            -- Messenger PSID / WhatsApp JID
  customer_name          text,
  is_ai_paused           boolean not null default false,
  paused_at              timestamptz,
  pause_reason           text,                     -- 'dashboard' | 'phone' | null
  last_message_at        timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists uq_omni_conversations_shop_platform_customer
  on public.omni_conversations(shop_id, platform, customer_external_id);
create index if not exists idx_omni_conversations_shop_last_message
  on public.omni_conversations(shop_id, last_message_at desc);

create table if not exists public.conversation_messages (
  id                     uuid primary key default uuid_generate_v4(),
  conversation_id        uuid not null references public.omni_conversations(id) on delete cascade,
  direction              text not null check (direction in ('in', 'out')),
  sender                 text not null check (sender in ('customer', 'ai', 'human')),
  body                   text,
  external_message_id    text,
  created_at             timestamptz not null default now()
);

create index if not exists idx_conversation_messages_conv_created
  on public.conversation_messages(conversation_id, created_at);

create table if not exists public.ai_message_logs (
  id                     uuid primary key default uuid_generate_v4(),
  conversation_id        uuid not null references public.omni_conversations(id) on delete cascade,
  message_external_id    text not null,
  created_at             timestamptz not null default now()
);

create unique index if not exists uq_ai_message_logs_external_id
  on public.ai_message_logs(message_external_id);

alter table public.clients_channels enable row level security;
alter table public.omni_conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.ai_message_logs enable row level security;

create policy "shop_owners_read_clients_channels"
  on public.clients_channels for select
  using (shop_id in (select id from public.shops where owner_id = auth.uid()));

create policy "shop_owners_read_omni_conversations"
  on public.omni_conversations for select
  using (shop_id in (select id from public.shops where owner_id = auth.uid()));

create policy "shop_owners_read_conversation_messages"
  on public.conversation_messages for select
  using (
    conversation_id in (
      select id from public.omni_conversations
      where shop_id in (select id from public.shops where owner_id = auth.uid())
    )
  );

create policy "shop_owners_read_ai_message_logs"
  on public.ai_message_logs for select
  using (
    conversation_id in (
      select id from public.omni_conversations
      where shop_id in (select id from public.shops where owner_id = auth.uid())
    )
  );

-- Service role (webhooks, bot-server) writes via service key — no insert/update policy needed.

alter publication supabase_realtime add table public.omni_conversations;
alter publication supabase_realtime add table public.conversation_messages;
