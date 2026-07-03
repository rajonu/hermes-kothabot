import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { invalidateTrainingData } from '@/lib/widget-training';

async function getClinicShop() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await (supabase as any)
    .from('shops').select('id, category').eq('owner_id', user.id).single();
  return shop?.category === 'clinic' ? shop : null;
}

export async function POST(req: NextRequest) {
  const shop = await getClinicShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { doctor_id, weekday, start_time, end_time, location_id } = body ?? {};
  if (!doctor_id || weekday === undefined || !start_time || !end_time) {
    return NextResponse.json({ error: 'doctor_id, weekday, start_time, end_time required' }, { status: 422 });
  }
  const db = createAdminClient();
  const { data, error } = await (db as any)
    .from('clinic_schedules')
    .insert({ shop_id: shop.id, doctor_id, weekday, start_time, end_time, location_id: location_id || null })
    .select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateTrainingData(shop.id);
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const shop = await getClinicShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 422 });
  const db = createAdminClient();
  const { error } = await (db as any)
    .from('clinic_schedules').delete().eq('id', body.id).eq('shop_id', shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateTrainingData(shop.id);
  return NextResponse.json({ ok: true });
}
