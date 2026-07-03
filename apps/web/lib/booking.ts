/**
 * KothaBot Clinic Booking Engine — single source of truth for all appointment scheduling.
 *
 * Every surface (dashboard, public widget, voice AI, v1 API, WordPress plugin)
 * calls getAvailableSlots() and createBooking() here — never reimplements slot math.
 *
 * Slots are COMPUTED, not pre-stored:
 *   doctor schedule ranges - special days - existing live appointments = free slots
 * The unique index on (doctor_id, starts_at) is the final race guard against double-booking.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { syncOrderToCalendar } from '@/lib/calendar-sync';
import { dispatchWebhook } from '@/lib/webhook-delivery';

const SHOP_TZ = 'Asia/Dhaka';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  starts_at: string; // ISO 8601 UTC
  ends_at:   string;
  label:     string; // e.g. "09:30 AM" in shop timezone
}

export interface BookingParams {
  shopId:      string;
  doctorId:    string;
  serviceId:   string;
  locationId?: string;
  startsAt:    string; // ISO 8601 — the chosen slot
  patient: {
    name:   string;
    phone:  string;
    email?: string;
  };
  notes?: string;
  /** Internal flag for voice/API so webhook loop guard knows origin */
  origin?: string;
}

export interface BookingResult {
  ok: true;
  orderId:   string;
  startsAt:  string;
  endsAt:    string;
  doctor:    string;
  service:   string;
  location?: string;
}

export interface BookingError {
  ok: false;
  code: 'slot_taken' | 'doctor_unavailable' | 'shop_not_clinic' | 'invalid_params' | 'db_error';
  message: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns available time slots for a doctor+service on a given date.
 * Date should be YYYY-MM-DD in shop timezone (Asia/Dhaka).
 */
export async function getAvailableSlots(
  shopId:     string,
  doctorId:   string,
  serviceId:  string,
  dateStr:    string, // YYYY-MM-DD
  locationId?: string,
): Promise<TimeSlot[]> {
  const db = createAdminClient();

  // 1. Get service duration (fallback to doctor metadata, then 30 min)
  const [{ data: service }, { data: doctor }] = await Promise.all([
    (db as any).from('products').select('metadata').eq('id', serviceId).eq('shop_id', shopId).single(),
    (db as any).from('products').select('metadata').eq('id', doctorId).eq('shop_id', shopId).single(),
  ]);

  const durationMin: number =
    service?.metadata?.duration_min ??
    doctor?.metadata?.duration_min ??
    30;

  // 2. Weekday for this date (0=Sun … 6=Sat) in shop TZ
  const dateParts = dateStr.split('-').map(Number);
  const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const weekday   = localDate.getDay(); // JS: 0=Sun

  // 3. Fetch doctor's working ranges for this weekday
  let schedQ = (db as any)
    .from('clinic_schedules')
    .select('start_time, end_time')
    .eq('shop_id', shopId)
    .eq('doctor_id', doctorId)
    .eq('weekday', weekday);
  if (locationId) schedQ = schedQ.eq('location_id', locationId);
  const { data: ranges } = await schedQ;

  if (!ranges?.length) return [];

  // 4. Check for special days (full off or custom hours)
  const { data: special } = await (db as any)
    .from('clinic_special_days')
    .select('type, start_time, end_time')
    .eq('shop_id', shopId)
    .eq('date', dateStr)
    .or(`doctor_id.eq.${doctorId},doctor_id.is.null`);

  // If any full-off special day applies, no slots
  if (special?.some((s: any) => s.type === 'off' || s.type === 'holiday')) return [];

  // Custom hours override if present
  const customHours = special?.find((s: any) => s.type === 'custom' && s.start_time && s.end_time);
  const workingRanges: { start: string; end: string }[] = customHours
    ? [{ start: customHours.start_time, end: customHours.end_time }]
    : (ranges as any[]).map((r: any) => ({ start: r.start_time, end: r.end_time }));

  // 5. Fetch existing live appointments for this doctor on this date
  const dayStart = `${dateStr}T00:00:00+06:00`; // Asia/Dhaka is UTC+6
  const dayEnd   = `${dateStr}T23:59:59+06:00`;
  const { data: existing } = await (db as any)
    .from('orders')
    .select('starts_at, ends_at')
    .eq('shop_id', shopId)
    .eq('doctor_id', doctorId)
    .eq('type', 'appointment')
    .neq('status', 'cancelled')
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd);

  const bookedRanges: { s: number; e: number }[] = (existing ?? []).map((o: any) => ({
    s: new Date(o.starts_at).getTime(),
    e: new Date(o.ends_at ?? o.starts_at).getTime() + durationMin * 60000,
  }));

  // 6. Generate candidate slots and filter against booked ranges + past time
  const now        = Date.now();
  const bufferMs   = 30 * 60000; // don't show slots starting in the next 30 min
  const slots: TimeSlot[] = [];

  for (const range of workingRanges) {
    const [sh, sm] = range.start.split(':').map(Number);
    const [eh, em] = range.end.split(':').map(Number);

    let cursor = new Date(localDate);
    cursor.setHours(sh, sm, 0, 0);
    const rangeEnd = new Date(localDate);
    rangeEnd.setHours(eh, em, 0, 0);

    while (cursor.getTime() + durationMin * 60000 <= rangeEnd.getTime()) {
      const slotStart = cursor.getTime();
      const slotEnd   = slotStart + durationMin * 60000;

      const isPast    = slotStart < now + bufferMs;
      const isBooked  = bookedRanges.some(b => slotStart < b.e && slotEnd > b.s);

      if (!isPast && !isBooked) {
        const startDate = new Date(slotStart);
        slots.push({
          starts_at: startDate.toISOString(),
          ends_at:   new Date(slotEnd).toISOString(),
          label:     formatTime(startDate),
        });
      }

      cursor = new Date(slotStart + durationMin * 60000);
    }
  }

  return slots;
}

/**
 * Create a validated appointment. Validates availability server-side,
 * then inserts into orders. The unique index on (doctor_id, starts_at)
 * is the final concurrency guard against races.
 */
export async function createBooking(params: BookingParams): Promise<BookingResult | BookingError> {
  const { shopId, doctorId, serviceId, locationId, startsAt, patient, notes, origin } = params;

  if (!shopId || !doctorId || !serviceId || !startsAt || !patient?.name || !patient?.phone) {
    return { ok: false, code: 'invalid_params', message: 'Missing required booking fields.' };
  }

  const db = createAdminClient();

  // 1. Verify shop is clinic
  const { data: shop } = await (db as any)
    .from('shops')
    .select('category, name')
    .eq('id', shopId)
    .single();
  if (shop?.category !== 'clinic') {
    return { ok: false, code: 'shop_not_clinic', message: 'Booking engine is for clinic category only.' };
  }

  // 2. Fetch doctor + service for metadata
  const [{ data: doctor }, { data: service }, { data: location }] = await Promise.all([
    (db as any).from('products').select('name, metadata').eq('id', doctorId).eq('shop_id', shopId).single(),
    (db as any).from('products').select('name, metadata, price').eq('id', serviceId).eq('shop_id', shopId).single(),
    locationId
      ? (db as any).from('clinic_locations').select('name').eq('id', locationId).eq('shop_id', shopId).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!doctor) return { ok: false, code: 'invalid_params', message: 'Doctor not found.' };
  if (!service) return { ok: false, code: 'invalid_params', message: 'Service not found.' };

  // 3. Server-side availability re-check (prevent stale client from booking unavailable slot)
  const startsMs     = new Date(startsAt).getTime();
  const durationMin: number = service.metadata?.duration_min ?? doctor.metadata?.duration_min ?? 30;
  const endsAt       = new Date(startsMs + durationMin * 60000).toISOString();
  const dateStr      = new Date(startsAt).toLocaleDateString('en-CA', { timeZone: SHOP_TZ }); // YYYY-MM-DD

  const slots = await getAvailableSlots(shopId, doctorId, serviceId, dateStr, locationId);
  const slotValid = slots.some(s => new Date(s.starts_at).getTime() === startsMs);
  if (!slotValid) {
    return { ok: false, code: 'doctor_unavailable', message: 'This time slot is no longer available.' };
  }

  // 4. Upsert customer by phone
  const { data: customer } = await (db as any)
    .from('customers')
    .upsert(
      { shop_id: shopId, name: patient.name, phone: patient.phone },
      { onConflict: 'shop_id,phone', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  // 5. Insert appointment order (unique index guards race)
  let insertResult: any;
  try {
    insertResult = await (db as any)
      .from('orders')
      .insert({
        shop_id:     shopId,
        customer_id: customer?.id ?? null,
        type:        'appointment',
        status:      'pending',
        doctor_id:   doctorId,
        service_id:  serviceId,
        location_id: locationId ?? null,
        starts_at:   startsAt,
        ends_at:     endsAt,
        items:       [{ name: service.name, quantity: 1, unit_price: service.price ?? null }],
        total_amount: service.price ?? null,
        metadata: {
          doctor_name:     doctor.name,
          service_name:    service.name,
          location_name:   location?.data?.name ?? null,
          appointment_at:  startsAt,
          patient_name:    patient.name,
          patient_phone:   patient.phone,
          patient_email:   patient.email ?? null,
          department:      doctor.metadata?.department ?? null,
          _kothabot_origin: origin ?? 'booking_engine',
        },
        notes: notes ?? null,
      })
      .select('id')
      .single();
  } catch (e: any) {
    // Unique index violation = race condition, slot just got taken
    if (e?.code === '23505') {
      return { ok: false, code: 'slot_taken', message: 'This slot was just booked. Please choose another time.' };
    }
    return { ok: false, code: 'db_error', message: e?.message ?? 'Failed to create appointment.' };
  }

  if (insertResult.error) {
    if (insertResult.error.code === '23505') {
      return { ok: false, code: 'slot_taken', message: 'This slot was just booked. Please choose another time.' };
    }
    return { ok: false, code: 'db_error', message: insertResult.error.message };
  }

  const orderId = insertResult.data.id;

  // 6. Fire calendar sync + webhook (both fire-and-forget)
  syncOrderToCalendar(orderId, shopId);
  dispatchWebhook(shopId, 'appointment.created', insertResult.data);

  return {
    ok:        true,
    orderId,
    startsAt,
    endsAt,
    doctor:    doctor.name,
    service:   service.name,
    location:  location?.data?.name,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true,
    timeZone: SHOP_TZ,
  });
}
