import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const db = supabase as any;
  const { data: shop } = await db.from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ count: 0 });

  const [{ count: pendingOrders }, { count: unreadSupport }, { data: openConvos }] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'pending'),
    db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('unread_client', true),
    db.from('omni_conversations').select('last_message_at, last_read_at').eq('shop_id', shop.id).is('archived_at', null),
  ]);

  const unreadLiveChat = (openConvos ?? []).some(
    (c: any) => !c.last_read_at || new Date(c.last_message_at) > new Date(c.last_read_at)
  );

  return NextResponse.json({
    count: (pendingOrders ?? 0) + (unreadSupport ?? 0),
    unreadLiveChat,
  });
}
