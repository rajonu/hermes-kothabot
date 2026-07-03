/**
 * GET /api/v1/availability?doctor_id=&service_id=&date=YYYY-MM-DD&location_id=
 * Bearer-key auth. Returns computed free slots for WP plugin / external integrations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { getAvailableSlots } from '@/lib/booking';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const sp         = new URL(req.url).searchParams;
    const doctorId   = sp.get('doctor_id')  ?? '';
    const serviceId  = sp.get('service_id') ?? '';
    const date       = sp.get('date')       ?? '';
    const locationId = sp.get('location_id') ?? undefined;

    if (!doctorId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'doctor_id, service_id, and date are required' },
        { status: 400 }
      );
    }

    const slots = await getAvailableSlots(ctx.shopId, doctorId, serviceId, date, locationId);
    return NextResponse.json({ data: slots });
  });
}
