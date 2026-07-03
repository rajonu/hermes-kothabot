import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

async function getClinicShop() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await (supabase as any)
    .from('shops').select('id, category').eq('owner_id', user.id).single();
  return shop?.category === 'clinic' ? shop : null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await getClinicShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = createAdminClient();
  const { error } = await (db as any)
    .from('clinic_locations').delete().eq('id', id).eq('shop_id', shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await getClinicShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const db = createAdminClient();
  const allowed = ['name', 'address', 'phone', 'status', 'sort_order'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in (body ?? {})) update[k] = body[k];
  const { data, error } = await (db as any)
    .from('clinic_locations').update(update).eq('id', id).eq('shop_id', shop.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
