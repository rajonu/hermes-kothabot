import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchWebhook } from '@/lib/webhook-delivery';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .eq('type', 'appointment')
      .single();

    if (error || !data) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    return NextResponse.json({ data });
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Include structured scheduling fields introduced in migration 019
    const allowed = ['status', 'metadata', 'notes', 'total_amount', 'doctor_id', 'service_id', 'location_id', 'starts_at', 'ends_at'];
    const updates: Record<string, any> = {};
    for (const k of allowed) {
      if (k in body) updates[k] = body[k];
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('orders')
      .update(updates)
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .eq('type', 'appointment')
      .select('*')
      .single();

    if (error || !data) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    dispatchWebhook(ctx.shopId, 'appointment.updated', data);
    return NextResponse.json({ data });
  });
}
