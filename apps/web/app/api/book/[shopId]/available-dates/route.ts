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
  const doctorId  = searchParams.get('doctor');
  const serviceId = searchParams.get('service');
  const month     = searchParams.get('month'); // YYYY-MM

  if (!doctorId || !serviceId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Missing or invalid params' }, { status: 400, headers: CORS });
  }

  const db = createAdminClient();

  const { data: shop } = await (db as any)
    .from('shops')
    .select('category')
    .eq('id', shopId)
    .single();
  if (!shop || shop.category !== 'clinic') {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const { data: schedules } = await (db as any)
    .from('clinic_schedules')
    .select('weekday, start_time, end_time')
    .eq('shop_id', shopId)
    .eq('doctor_id', doctorId);

  if (!schedules?.length) {
    return NextResponse.json({ available: [] }, { headers: CORS });
  }

  const scheduledWeekdays = new Set<number>(schedules.map((s: any) => s.weekday));

  const [year, mon] = month.split('-').map(Number);
  const firstOfMonth = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const lastOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

  const { data: specialDays } = await (db as any)
    .from('clinic_special_days')
    .select('date, type')
    .eq('shop_id', shopId)
    .gte('date', firstOfMonth)
    .lte('date', lastOfMonth)
    .or(`doctor_id.eq.${doctorId},doctor_id.is.null`);

  const offDates = new Set<string>(
    (specialDays ?? [])
      .filter((d: any) => d.type === 'off' || d.type === 'holiday')
      .map((d: any) => d.date as string)
  );

  const available: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(year, mon - 1, day).getDay();
    if (scheduledWeekdays.has(weekday) && !offDates.has(dateStr)) {
      available.push(dateStr);
    }
  }

  return NextResponse.json({ available }, { headers: CORS });
}
