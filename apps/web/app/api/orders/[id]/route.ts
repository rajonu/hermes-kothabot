import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateOrderInCalendar, cancelOrderInCalendar } from '@/lib/calendar-sync';

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, supabase };
  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return { ok: false, supabase };
  return { ok: true, supabase, shopId: shop.id as string };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const update: any = {};
  for (const k of ['type','status','items','total_amount','metadata','notes']) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  const { data, error } = await (g.supabase as any).from('orders')
    .update(update).eq('id', id).eq('shop_id', g.shopId).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget calendar update
  if (data && (data.type === 'appointment' || data.type === 'reservation' || data.type === 'booking')) {
    if (data.status === 'cancelled') cancelOrderInCalendar(id, g.shopId!);
    else updateOrderInCalendar(id, g.shopId!);
  }

  return NextResponse.json({ order: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Fire-and-forget cancel in calendar before delete
  cancelOrderInCalendar(id, g.shopId!);
  const { error } = await (g.supabase as any).from('orders').delete().eq('id', id).eq('shop_id', g.shopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
