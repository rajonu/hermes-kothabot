import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabase as any;
  const { data: shop } = await db.from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { endpoint } = await req.json();
  await db.from('push_subscriptions').delete().eq('shop_id', shop.id).eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}
