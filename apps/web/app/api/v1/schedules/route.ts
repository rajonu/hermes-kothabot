/**
 * GET  /api/v1/schedules?doctor_id=  — list weekly schedule rows
 * POST /api/v1/schedules             — create a schedule row
 * DELETE /api/v1/schedules?doctor_id=&weekday= — clear a doctor's day schedule
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const doctorId = new URL(req.url).searchParams.get('doctor_id');
    const db = createAdminClient();
    let q = (db as any)
      .from('clinic_schedules')
      .select('id, doctor_id, location_id, weekday, start_time, end_time')
      .eq('shop_id', ctx.shopId)
      .order('doctor_id')
      .order('weekday')
      .order('start_time');
    if (doctorId) q = q.eq('doctor_id', doctorId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    const { doctor_id, weekday, start_time, end_time, location_id } = body ?? {};
    if (!doctor_id || weekday === undefined || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'doctor_id, weekday, start_time, end_time required' },
        { status: 422 }
      );
    }
    const db = createAdminClient();
    const { data, error } = await (db as any)
      .from('clinic_schedules')
      .insert({
        shop_id:     ctx.shopId,
        doctor_id,
        weekday,
        start_time,
        end_time,
        location_id: location_id ?? null,
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  });
}

export async function DELETE(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const sp = new URL(req.url).searchParams;
    const doctorId = sp.get('doctor_id');
    const weekday  = sp.get('weekday');
    if (!doctorId) return NextResponse.json({ error: 'doctor_id required' }, { status: 422 });
    const db = createAdminClient();
    let q = (db as any)
      .from('clinic_schedules')
      .delete()
      .eq('shop_id', ctx.shopId)
      .eq('doctor_id', doctorId);
    if (weekday !== null) q = q.eq('weekday', Number(weekday));
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
