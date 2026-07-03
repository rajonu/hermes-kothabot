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
    .from('clients_channels')
    .select('id, wa_phone, is_active, connected_at, last_error')
    .eq('shop_id', shop.id)
    .eq('channel_type', 'whatsapp')
    .maybeSingle();

  if (!data || !data.is_active) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    phone: data.wa_phone,
    connected_at: data.connected_at,
    last_error: data.last_error,
  });
}
