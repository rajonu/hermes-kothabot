import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabase as any;
  const { data: shop } = await db.from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const sub: PushSubscriptionJSON = await req.json();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await db.from('push_subscriptions').upsert({
    shop_id:     shop.id,
    endpoint:    sub.endpoint,
    keys_p256dh: sub.keys.p256dh,
    keys_auth:   sub.keys.auth,
  }, { onConflict: 'shop_id,endpoint' });

  return NextResponse.json({ ok: true });
}
