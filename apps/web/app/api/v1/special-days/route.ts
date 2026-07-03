/**
 * GET    /api/v1/special-days?doctor_id=&from=&to=
 * POST   /api/v1/special-days   — create a special day (off/holiday/custom)
 * DELETE /api/v1/special-days/[id] handled by [id]/route.ts
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const sp = new URL(req.url).searchParams;
    const doctorId = sp.get('doctor_id');
    const from     = sp.get('from');
    const to       = sp.get('to');

    const db = createAdminClient();
    let q = (db as any)
      .from('clinic_special_days')
      .select('id, doctor_id, location_id, date, type, start_time, end_time, note')
      .eq('shop_id', ctx.shopId)
      .order('date');
    if (doctorId) q = q.eq('doctor_id', doctorId);
    if (from)     q = q.gte('date', from);
    if (to)       q = q.lte('date', to);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    const { date, type, doctor_id, location_id, start_time, end_time, note } = body ?? {};
    if (!date || !type) {
      return NextResponse.json({ error: 'date and type are required' }, { status: 422 });
    }
    const db = createAdminClient();
    const { data, error } = await (db as any)
      .from('clinic_special_days')
      .insert({
        shop_id:     ctx.shopId,
        doctor_id:   doctor_id ?? null,
        location_id: location_id ?? null,
        date,
        type,
        start_time:  start_time ?? null,
        end_time:    end_time ?? null,
        note:        note ?? null,
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  });
}
