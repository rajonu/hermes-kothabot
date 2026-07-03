/** Internal dashboard routes for clinic location CRUD — Supabase session auth. */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

async function getClinicShop() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, shop: null };
  const { data: shop } = await (supabase as any)
    .from('shops').select('id, category').eq('owner_id', user.id).single();
  return { user, shop: shop?.category === 'clinic' ? shop : null };
}

export async function GET() {
  const { shop } = await getClinicShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createAdminClient();
  const { data } = await (db as any)
    .from('clinic_locations').select('*').eq('shop_id', shop.id).order('sort_order');
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { shop } = await getClinicShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: 'name required' }, { status: 422 });
  const db = createAdminClient();
  const { data, error } = await (db as any)
    .from('clinic_locations')
    .insert({ shop_id: shop.id, name: body.name, address: body.address ?? null, phone: body.phone ?? null, status: body.status ?? 'active', sort_order: body.sort_order ?? 0 })
    .select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
