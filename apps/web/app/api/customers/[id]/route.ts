import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function guard(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, supabase };
  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return { ok: false, supabase };
  return { ok: true, supabase, shopId: shop.id as string };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (!g.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const update: any = {};
  if (body.name    !== undefined) update.name    = body.name?.trim() || null;
  if (body.phone   !== undefined) update.phone   = body.phone?.trim() || null;
  if (body.address !== undefined) update.address = body.address?.trim() || null;
  const { data, error } = await (g.supabase as any).from('customers')
    .update(update).eq('id', id).eq('shop_id', g.shopId).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (!g.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await (g.supabase as any).from('customers').delete().eq('id', id).eq('shop_id', g.shopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
