import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getShop(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, shopId: null };
  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  return { supabase, shopId: shop?.id ?? null };
}

export async function POST(req: NextRequest) {
  const { supabase, shopId } = await getShop(req);
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { data, error } = await (supabase as any).from('customers').insert({
    shop_id: shopId,
    name: body.name.trim(),
    phone: body.phone?.trim() || null,
    address: body.address?.trim() || null,
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}
