/**
 * Calendar sync service — formats KothaBot orders as Google Calendar events
 * and handles create / update / cancel lifecycle.
 *
 * Fire-and-forget: never throws, never blocks the calling request.
 */

import {
  getIntegration,
  getValidToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventPayload,
} from '@/lib/google-calendar';
import { createAdminClient } from '@/lib/supabase/server';

const BOOKING_CATEGORIES = new Set([
  'clinic', 'salon', 'services', 'restaurant',
  'real_estate', 'education', 'creative_agency', 'other',
]);

const TIME_ZONE = 'Asia/Dhaka';
const EVENT_DURATION_MIN = 60; // default 1-hour slot when no end time provided

/* ── Public API ─────────────────────────────────────────────────── */

export async function syncOrderToCalendar(orderId: string, shopId: string): Promise<void> {
  try {
    const integration = await getIntegration(shopId);
    if (!integration?.auto_sync) return;

    const db = createAdminClient();
    const { data: order } = await (db as any)
      .from('orders')
      .select('*, customers(name, phone, address)')
      .eq('id', orderId)
      .eq('shop_id', shopId)
      .single();

    if (!order) return;
    if (order.type !== 'appointment' && order.type !== 'reservation' && order.type !== 'booking') return;

    const { data: shop } = await (db as any)
      .from('shops')
      .select('name, category')
      .eq('id', shopId)
      .single();

    if (!shop || !BOOKING_CATEGORIES.has(shop.category)) return;

    const accessToken = await getValidToken(integration);
    const event = buildEvent(order, shop);

    const { id: googleEventId } = await createCalendarEvent(
      accessToken,
      integration.calendar_id,
      event
    );

    // Record the mapping
    await (db as any).from('calendar_events').upsert({
      shop_id:        shopId,
      order_id:       orderId,
      google_event_id: googleEventId,
      calendar_id:    integration.calendar_id,
      sync_status:    'synced',
      error_message:  null,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'order_id' });

    // Bump stats
    await (db as any).from('calendar_integrations')
      .update({
        events_created: (db as any).rpc('increment_cal_created' as any) as any,
        last_sync_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId);

  } catch (err: any) {
    console.error('[calendar-sync] create failed:', err?.message);
    recordError(orderId, shopId, err?.message);
  }
}

export async function updateOrderInCalendar(orderId: string, shopId: string): Promise<void> {
  try {
    const integration = await getIntegration(shopId);
    if (!integration?.sync_updates) return;

    const db = createAdminClient();
    const { data: calEvent } = await (db as any)
      .from('calendar_events')
      .select('google_event_id, calendar_id')
      .eq('order_id', orderId)
      .single();

    if (!calEvent) return;

    const { data: order } = await (db as any)
      .from('orders')
      .select('*, customers(name, phone, address)')
      .eq('id', orderId)
      .eq('shop_id', shopId)
      .single();

    const { data: shop } = await (db as any)
      .from('shops')
      .select('name, category')
      .eq('id', shopId)
      .single();

    if (!order || !shop) return;

    const accessToken = await getValidToken(integration);
    await updateCalendarEvent(
      accessToken,
      calEvent.calendar_id,
      calEvent.google_event_id,
      buildEvent(order, shop)
    );

    await (db as any).from('calendar_events')
      .update({ sync_status: 'synced', error_message: null, updated_at: new Date().toISOString() })
      .eq('order_id', orderId);

    await (db as any).from('calendar_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('shop_id', shopId);

  } catch (err: any) {
    console.error('[calendar-sync] update failed:', err?.message);
    recordError(orderId, shopId, err?.message);
  }
}

export async function cancelOrderInCalendar(orderId: string, shopId: string): Promise<void> {
  try {
    const integration = await getIntegration(shopId);
    if (!integration?.sync_cancels) return;

    const db = createAdminClient();
    const { data: calEvent } = await (db as any)
      .from('calendar_events')
      .select('google_event_id, calendar_id')
      .eq('order_id', orderId)
      .single();

    if (!calEvent) return;

    const accessToken = await getValidToken(integration);
    await deleteCalendarEvent(accessToken, calEvent.calendar_id, calEvent.google_event_id);

    await (db as any).from('calendar_events')
      .update({ sync_status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('order_id', orderId);

    await (db as any).from('calendar_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
      })
      .eq('shop_id', shopId);

  } catch (err: any) {
    console.error('[calendar-sync] cancel failed:', err?.message);
  }
}

/* ── Event builder — category-aware ─────────────────────────────── */

function buildEvent(order: any, shop: any): CalendarEventPayload {
  const meta     = order.metadata ?? {};
  const customer = order.customers ?? {};
  const name     = customer.name ?? meta.patient_name ?? meta.customer_name ?? 'Customer';
  const phone    = customer.phone ?? meta.customer_phone ?? '';
  const items    = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] ?? {};

  const { start, end } = resolveTime(meta, order.created_at);

  switch (shop.category) {
    case 'clinic':
      return {
        summary: `${name} — ${meta.doctor_name ?? firstItem.doctor_name ?? 'Appointment'}`,
        description: buildDesc({
          'Patient Name': name,
          'Phone':        phone,
          'Doctor':       meta.doctor_name ?? firstItem.doctor_name ?? '',
          'Department':   meta.department  ?? '',
          'Service':      meta.service_name ?? firstItem.service_name ?? firstItem.name ?? '',
          'Location':     meta.location_name ?? '',
          'Date & Time':  meta.appointment_at ?? meta.booking_at ?? '',
          'Notes':        order.notes ?? '',
        }),
        location: meta.location_name ?? shop.name,
        start: { dateTime: order.starts_at ?? start, timeZone: TIME_ZONE },
        end:   { dateTime: order.ends_at   ?? end,   timeZone: TIME_ZONE },
      };

    case 'salon':
    case 'services':
      return {
        summary: `Booking — ${name}`,
        description: buildDesc({
          'Client Name': name,
          'Phone':       phone,
          'Service':     meta.service_name ?? firstItem.name ?? '',
          'Stylist':     meta.stylist ?? meta.staff_name ?? '',
          'Booking At':  meta.booking_at ?? meta.appointment_at ?? '',
          'Notes':       order.notes ?? '',
        }),
        location: shop.name,
        start: { dateTime: start, timeZone: TIME_ZONE },
        end:   { dateTime: end,   timeZone: TIME_ZONE },
      };

    case 'restaurant':
      return {
        summary: `Reservation — ${name}`,
        description: buildDesc({
          'Customer':   name,
          'Phone':      phone,
          'Party Size': meta.party_size ?? '',
          'Time':       meta.reservation_at ?? meta.booking_at ?? '',
          'Notes':      order.notes ?? '',
        }),
        location: shop.name,
        start: { dateTime: start, timeZone: TIME_ZONE },
        end:   { dateTime: end,   timeZone: TIME_ZONE },
      };

    case 'real_estate':
      return {
        summary: `Property Visit — ${name}`,
        description: buildDesc({
          'Lead Name': name,
          'Phone':     phone,
          'Property':  meta.property_name ?? firstItem.name ?? '',
          'Location':  meta.property_address ?? customer.address ?? '',
          'Visit At':  meta.visit_at ?? meta.booking_at ?? '',
          'Notes':     order.notes ?? '',
        }),
        start: { dateTime: start, timeZone: TIME_ZONE },
        end:   { dateTime: end,   timeZone: TIME_ZONE },
      };

    case 'education':
      return {
        summary: `Meeting — ${name}`,
        description: buildDesc({
          'Student/Parent': name,
          'Phone':          phone,
          'Course':         meta.course_name ?? firstItem.name ?? '',
          'Instructor':     meta.instructor ?? '',
          'Meeting At':     meta.booking_at ?? meta.appointment_at ?? '',
          'Notes':          order.notes ?? '',
        }),
        location: shop.name,
        start: { dateTime: start, timeZone: TIME_ZONE },
        end:   { dateTime: end,   timeZone: TIME_ZONE },
      };

    case 'creative_agency':
      return {
        summary: `Consultation — ${name}`,
        description: buildDesc({
          'Client':       name,
          'Phone':        phone,
          'Project':      meta.project_name ?? firstItem.name ?? '',
          'Service':      meta.service_name ?? '',
          'Meeting At':   meta.booking_at ?? meta.appointment_at ?? '',
          'Notes':        order.notes ?? '',
        }),
        location: shop.name,
        start: { dateTime: start, timeZone: TIME_ZONE },
        end:   { dateTime: end,   timeZone: TIME_ZONE },
      };

    default:
      return {
        summary: `Appointment — ${name}`,
        description: buildDesc({
          'Customer': name,
          'Phone':    phone,
          'Service':  firstItem.name ?? '',
          'Time':     meta.booking_at ?? meta.appointment_at ?? '',
          'Notes':    order.notes ?? '',
        }),
        location: shop.name,
        start: { dateTime: start, timeZone: TIME_ZONE },
        end:   { dateTime: end,   timeZone: TIME_ZONE },
      };
  }
}

function buildDesc(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function resolveTime(meta: any, fallback: string): { start: string; end: string } {
  const raw = meta.appointment_at ?? meta.booking_at ?? meta.reservation_at ?? meta.visit_at ?? fallback;

  let startMs: number;
  try {
    startMs = new Date(raw).getTime();
    if (isNaN(startMs)) throw new Error();
  } catch {
    // Fallback: today at next round hour
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    startMs = now.getTime();
  }

  const endMs = startMs + EVENT_DURATION_MIN * 60 * 1000;
  return {
    start: new Date(startMs).toISOString(),
    end:   new Date(endMs).toISOString(),
  };
}

async function recordError(orderId: string, shopId: string, message: string) {
  try {
    const db = createAdminClient();
    await (db as any).from('calendar_events').upsert({
      shop_id:     shopId,
      order_id:    orderId,
      google_event_id: '',
      sync_status: 'failed',
      error_message: message?.slice(0, 500) ?? 'Unknown error',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id' });
    await (db as any).from('calendar_integrations')
      .update({ sync_errors: (db as any).rpc('increment_cal_errors' as any) as any })
      .eq('shop_id', shopId);
  } catch { /* never throw */ }
}
