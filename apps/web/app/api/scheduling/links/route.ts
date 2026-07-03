/**
 * POST /api/scheduling/links  — create a doctor-service or doctor-location link
 * DELETE /api/scheduling/links — remove a link
 *
 * Body: { type: 'doctor_location', doctor_id, location_id }
 *    or { type: 'doctor_service',  doctor_id, service_id  }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { invalidateTrainingData } from '@/lib/widget-training';

async function getShop() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await (supabase as any)
    .from('shops').select('id, category').eq('owner_id', user.id).single();
  if (!shop || shop.category !== 'clinic') return null;
  return shop;
}

export async function POST(req: NextRequest) {
  const shop = await getShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 });

  const db = createAdminClient();

  if (body.type === 'doctor_location') {
    await (db as any).from('clinic_doctor_locations').upsert(
      { shop_id: shop.id, doctor_id: body.doctor_id, location_id: body.location_id },
      { onConflict: 'doctor_id,location_id', ignoreDuplicates: true }
    );
  } else if (body.type === 'doctor_service') {
    await (db as any).from('clinic_doctor_services').upsert(
      { shop_id: shop.id, doctor_id: body.doctor_id, service_id: body.service_id },
      { onConflict: 'doctor_id,service_id', ignoreDuplicates: true }
    );
  } else {
    return NextResponse.json({ error: 'Unknown link type' }, { status: 400 });
  }

  invalidateTrainingData(shop.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const shop = await getShop();
  if (!shop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 });

  const db = createAdminClient();

  if (body.type === 'doctor_location') {
    await (db as any).from('clinic_doctor_locations')
      .delete()
      .eq('shop_id', shop.id)
      .eq('doctor_id', body.doctor_id)
      .eq('location_id', body.location_id);
  } else if (body.type === 'doctor_service') {
    await (db as any).from('clinic_doctor_services')
      .delete()
      .eq('shop_id', shop.id)
      .eq('doctor_id', body.doctor_id)
      .eq('service_id', body.service_id);
  } else {
    return NextResponse.json({ error: 'Unknown link type' }, { status: 400 });
  }

  invalidateTrainingData(shop.id);
  return NextResponse.json({ ok: true });
}
