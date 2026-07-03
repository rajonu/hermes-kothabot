-- Drop unused tables from the deletion pass
drop table if exists public.support_tickets cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.knowledge_sources cascade;
drop table if exists public.knowledge_chunks cascade;
drop table if exists public.session_analytics cascade;
drop table if exists public.invoices cascade;

-- The products table stays as it's used as cache for Sheets sync