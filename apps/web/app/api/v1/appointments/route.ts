/**
 * Appointments = orders with type='appointment'.
 * Exposed separately for category clarity (clinic, salon, services, education, etc.).
 *
 * POST: when doctor_id + service_id + starts_at are provided, routes through
 * lib/booking.ts createBooking() for clinic shops (validates availability,
 * prevents double-booking). Falls back to the old blind-insert for other categories.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchWebhook } from '@/lib/webhook-delivery';
import { createBooking } from '@/lib/booking';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const status = searchParams.get('status');

    const supabase = createAdminClient();
    let q = (supabase as any)
      .from('orders')
      .select('id, status, items, total_amount, notes, metadata, customer_id, created_at', { count: 'exact' })
      .eq('shop_id', ctx.shopId)
      .eq('type', 'appointment')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data,
      meta: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });

    // Structured clinic booking — route through the engine for validation
    if (body.doctor_id && body.service_id && body.starts_at) {
      const result = await createBooking({
        shopId:     ctx.shopId,
        doctorId:   body.doctor_id,
        serviceId:  body.service_id,
        locationId: body.location_id,
        startsAt:   body.starts_at,
        patient: {
          name:  body.patient?.name  ?? body.metadata?.patient_name  ?? '',
          phone: body.patient?.phone ?? body.metadata?.patient_phone ?? '',
          email: body.patient?.email ?? body.metadata?.patient_email,
        },
        notes:  body.notes,
        origin: 'api_v1',
      });
      if (!result.ok) {
        const status = result.code === 'slot_taken' || result.code === 'doctor_unavailable' ? 409 : 400;
        return NextResponse.json({ error: result.message, code: result.code }, { status });
      }
      return NextResponse.json({ data: result }, { status: 201 });
    }

    // Legacy / non-clinic blind insert (other categories: salon, services, etc.)
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('orders')
      .insert({
        shop_id: ctx.shopId,
        customer_id: body.customer_id ?? null,
        type: 'appointment',
        status: body.status ?? 'pending',
        items: Array.isArray(body.items) ? body.items : [],
        total_amount: body.total_amount ?? null,
        metadata: body.metadata ?? {},
        notes: body.notes ?? null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    dispatchWebhook(ctx.shopId, 'appointment.created', data);
    return NextResponse.json({ data }, { status: 201 });
  });
}
