import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const db = createAdminClient();
  const { data } = await (db as any)
    .from('calendar_integrations')
    .select('id, google_email, calendar_id, connected_at, last_sync_at, auto_sync, sync_updates, sync_cancels, events_created, events_updated, events_cancelled, sync_errors')
    .eq('shop_id', shop.id)
    .single();

  if (!data) return NextResponse.json({ connected: false });

  // Fetch last sync error message for UI display
  const { data: lastFailed } = await (db as any)
    .from('calendar_events')
    .select('error_message, updated_at')
    .eq('shop_id', shop.id)
    .eq('sync_status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    connected: true,
    email:        data.google_email,
    calendar_id:  data.calendar_id,
    connected_at: data.connected_at,
    last_sync_at: data.last_sync_at,
    last_error:   lastFailed?.error_message ?? null,
    settings: {
      auto_sync:    data.auto_sync,
      sync_updates: data.sync_updates,
      sync_cancels: data.sync_cancels,
    },
    stats: {
      events_created:   data.events_created,
      events_updated:   data.events_updated,
      events_cancelled: data.events_cancelled,
      sync_errors:      data.sync_errors,
    },
  });
}
