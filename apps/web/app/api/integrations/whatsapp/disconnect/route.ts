import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const db = createAdminClient() as any;
  await db.from('clients_channels')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('shop_id', shop.id)
    .eq('channel_type', 'whatsapp');

  const baseUrl = process.env.BOT_SERVER_URL;
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (baseUrl && secret) {
    try {
      await fetch(`${baseUrl}/internal/wa-disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ shopId: shop.id }),
      });
    } catch (err: any) {
      console.error('[whatsapp/disconnect] failed to notify bot-server:', err?.message);
      // Don't fail the request — DB is already updated, the live socket will
      // get cleaned up on next bot-server restart at worst.
    }
  }

  return NextResponse.json({ success: true });
}
