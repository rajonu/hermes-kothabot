import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getShopId(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single();
  return shop?.id ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const shopId = await getShopId(supabase as any);
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, product_type, price, metadata } = body;
  if (!name || !product_type) return NextResponse.json({ error: 'name and product_type required' }, { status: 422 });

  const db = createAdminClient();
  const { data, error } = await (db as any)
    .from('products')
    .insert({
      shop_id:      shopId,
      name:         name.trim(),
      price:        price ?? null,
      is_available: true,
      metadata:     { ...(metadata ?? {}), product_type },
    })
    .select('id, name, price, metadata, is_available')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const shopId = await getShopId(supabase as any);
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 });

  const db = createAdminClient();
  await (db as any).from('products').delete().eq('id', id).eq('shop_id', shopId);
  return NextResponse.json({ ok: true });
}
