import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import { createAdminClient } from '@/lib/supabase/server';
import { revokeToken } from '@/lib/google-calendar';

export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const db = createAdminClient();
  const { data } = await (db as any)
    .from('calendar_integrations')
    .select('id, shop_id, google_email, calendar_id, connected_at, last_sync_at, auto_sync, events_created, events_updated, events_cancelled, sync_errors, shops(name)')
    .order('connected_at', { ascending: false });

  return NextResponse.json({ integrations: data ?? [] });
}

/** Admin disconnect — force-remove a client's calendar integration */
export async function DELETE(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shop_id } = await req.json().catch(() => ({}));
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 422 });

  const db = createAdminClient();
  const { data: integration } = await (db as any)
    .from('calendar_integrations')
    .select('access_token, refresh_token')
    .eq('shop_id', shop_id)
    .single();

  if (integration) {
    revokeToken(integration.access_token).catch(() => {});
    if (integration.refresh_token) revokeToken(integration.refresh_token).catch(() => {});
    await (db as any).from('calendar_integrations').delete().eq('shop_id', shop_id);
  }

  return NextResponse.json({ success: true });
}
