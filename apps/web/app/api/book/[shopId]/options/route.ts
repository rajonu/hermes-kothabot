/**
 * GET /api/book/[shopId]/options
 * Public, no-auth, CORS — cascading select options for the booking widget.
 *
 * Returns locations, then (if ?location=) doctors at that location,
 * then (if ?doctor=) services that doctor offers.
 * Used by the public /book/[shopId] page and the embed widget.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location');
  const doctorId   = searchParams.get('doctor');

  const db = createAdminClient();

  // Guard: clinic only
  const { data: shop } = await (db as any)
    .from('shops')
    .select('category, name')
    .eq('id', shopId)
    .single();
  if (!shop || shop.category !== 'clinic') {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  // Case 1: return locations
  if (!locationId && !doctorId) {
    const { data: locations } = await (db as any)
      .from('clinic_locations')
      .select('id, name, address, phone')
      .eq('shop_id', shopId)
      .eq('status', 'active')
      .order('sort_order');
    return NextResponse.json({ locations: locations ?? [] }, { headers: CORS });
  }

  // Case 2: return doctors for a location (or all if locationId='all')
  if (locationId && !doctorId) {
    let doctorIds: string[] | null = null;
    if (locationId !== 'all') {
      const { data: links } = await (db as any)
        .from('clinic_doctor_locations')
        .select('doctor_id')
        .eq('shop_id', shopId)
        .eq('location_id', locationId);
      doctorIds = (links ?? []).map((l: any) => l.doctor_id);
      // If no location-doctor links configured, show all doctors (matrix is optional)
    }

    let q = (db as any)
      .from('products')
      .select('id, name, metadata')
      .eq('shop_id', shopId)
      .eq('is_available', true)
      .filter('metadata->>product_type', 'eq', 'doctor');
    if (doctorIds?.length) q = q.in('id', doctorIds);
    const { data: doctors } = await q.order('sort_order');

    return NextResponse.json({
      doctors: (doctors ?? []).map((d: any) => ({
        id:             d.id,
        name:           d.name,
        specialization: d.metadata?.specialization ?? null,
        department:     d.metadata?.department ?? null,
        fee:            d.metadata?.consultation_fee ?? null,
        duration_min:   d.metadata?.duration_min ?? 30,
      })),
    }, { headers: CORS });
  }

  // Case 3: return services for a doctor
  if (doctorId) {
    const { data: links } = await (db as any)
      .from('clinic_doctor_services')
      .select('service_id')
      .eq('shop_id', shopId)
      .eq('doctor_id', doctorId);
    const serviceIds = (links ?? []).map((l: any) => l.service_id);

    // If no doctor-service links configured, show ALL shop services (matrix is optional)
    let q = (db as any)
      .from('products')
      .select('id, name, price, metadata')
      .eq('shop_id', shopId)
      .eq('is_available', true)
      .filter('metadata->>product_type', 'eq', 'service');
    if (serviceIds.length) q = q.in('id', serviceIds);
    const { data: services } = await q.order('sort_order');

    return NextResponse.json({
      services: (services ?? []).map((s: any) => ({
        id:           s.id,
        name:         s.name,
        price:        s.price,
        duration_min: s.metadata?.duration_min ?? 30,
      })),
    }, { headers: CORS });
  }

  return NextResponse.json({ error: 'Invalid query' }, { status: 400, headers: CORS });
}
