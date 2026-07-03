/**
 * GET /api/book/[shopId]/availability?doctor=&service=&date=YYYY-MM-DD
 * Public, no-auth, CORS.
 * Returns free time slots for a doctor+service on a given date.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/booking';

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
  const doctorId  = searchParams.get('doctor')   ?? '';
  const serviceId = searchParams.get('service')  ?? '';
  const date      = searchParams.get('date')     ?? '';
  const locationId = searchParams.get('location') ?? undefined;

  if (!doctorId || !serviceId || !date) {
    return NextResponse.json(
      { error: 'doctor, service, and date are required' },
      { status: 400, headers: CORS }
    );
  }

  // Basic date format guard
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400, headers: CORS });
  }

  const slots = await getAvailableSlots(shopId, doctorId, serviceId, date, locationId);
  return NextResponse.json({ slots }, { headers: CORS });
}
