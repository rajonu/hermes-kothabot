import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revokeToken } from '@/lib/google-calendar';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const db = createAdminClient();
  const { data: integration } = await (db as any)
    .from('calendar_integrations')
    .select('access_token, refresh_token')
    .eq('shop_id', shop.id)
    .single();

  if (integration) {
    // Revoke tokens (best-effort)
    revokeToken(integration.access_token).catch(() => {});
    if (integration.refresh_token) revokeToken(integration.refresh_token).catch(() => {});
    await (db as any).from('calendar_integrations').delete().eq('shop_id', shop.id);
  }

  return NextResponse.json({ success: true });
}
