/**
 * POST /api/book/[shopId]
 * Public, no-auth, CORS — create a clinic appointment.
 *
 * Body: { doctor_id, service_id, location_id?, starts_at,
 *         patient: { name, phone, email? }, notes? }
 *
 * Routes through lib/booking.ts createBooking() which validates availability
 * server-side and handles double-booking via unique index.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createBooking } from '@/lib/booking';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;

  // Subscription gate — block past_due shops (same as widget-chat)
  const db = createAdminClient();
  const { data: sub } = await (db as any)
    .from('subscriptions')
    .select('status')
    .eq('shop_id', shopId)
    .single();
  if (sub?.status === 'past_due') {
    return NextResponse.json(
      { error: 'Shop subscription is inactive.' },
      { status: 402, headers: CORS }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 422, headers: CORS });

  const result = await createBooking({
    shopId,
    doctorId:   body.doctor_id,
    serviceId:  body.service_id,
    locationId: body.location_id,
    startsAt:   body.starts_at,
    patient:    body.patient ?? {},
    notes:      body.notes,
    origin:     'booking_form',
  });

  if (!result.ok) {
    const status = result.code === 'slot_taken' || result.code === 'doctor_unavailable' ? 409 : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status, headers: CORS });
  }

  return NextResponse.json({ data: result }, { status: 201, headers: CORS });
}
