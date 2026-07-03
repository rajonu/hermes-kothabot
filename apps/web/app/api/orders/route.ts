import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncOrderToCalendar } from '@/lib/calendar-sync';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any).from('shops').select('id, category').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const body = await req.json();
  const category = shop.category as string;

  // Resolve / create customer if phone or name provided
  let customerId: string | null = body.customer_id ?? null;
  if (!customerId && (body.customer_phone || body.customer_name)) {
    if (body.customer_phone) {
      const { data: existing } = await (supabase as any).from('customers')
        .select('id').eq('shop_id', shop.id).eq('phone', body.customer_phone.trim()).maybeSingle();
      if (existing) customerId = existing.id;
    }
    if (!customerId) {
      const { data: created } = await (supabase as any).from('customers').insert({
        shop_id: shop.id,
        name: body.customer_name?.trim() || body.customer_phone?.trim() || 'Customer',
        phone: body.customer_phone?.trim() || null,
        address: body.customer_address?.trim() || null,
      }).select('id').single();
      customerId = created?.id ?? null;
    }
  }

  const inferredType =
    category === 'clinic' ? 'appointment' :
    (category === 'salon' || category === 'services') ? 'appointment' :
    (body.type ?? 'order');

  const noteParts: string[] = [];
  if (body.customer_name)    noteParts.push(`Name: ${body.customer_name}`);
  if (body.customer_phone)   noteParts.push(`Phone: ${body.customer_phone}`);
  if (body.customer_address) noteParts.push(`Address: ${body.customer_address}`);
  if (body.metadata?.doctor_name)    noteParts.push(`Doctor: ${body.metadata.doctor_name}`);
  if (body.metadata?.appointment_at) noteParts.push(`Appointment: ${body.metadata.appointment_at}`);
  if (body.metadata?.service_name)   noteParts.push(`Service: ${body.metadata.service_name}`);
  if (body.metadata?.booking_at)     noteParts.push(`Booking: ${body.metadata.booking_at}`);
  if (body.notes) noteParts.push(body.notes);

  const { data, error } = await (supabase as any).from('orders').insert({
    shop_id: shop.id,
    customer_id: customerId,
    type: inferredType,
    status: body.status ?? 'pending',
    items: Array.isArray(body.items) ? body.items : [],
    total_amount: body.total_amount ?? null,
    metadata: body.metadata ?? {},
    notes: noteParts.join(' | ') || null,
  }).select('*').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget calendar sync — never blocks the response
  if (data && (inferredType === 'appointment' || inferredType === 'reservation' || inferredType === 'booking')) {
    syncOrderToCalendar(data.id, shop.id);
  }

  return NextResponse.json({ order: data });
}
