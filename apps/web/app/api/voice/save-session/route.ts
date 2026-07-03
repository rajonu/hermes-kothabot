import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dispatchWebhook } from '@/lib/webhook-delivery';
import { sendPushNotification } from '@/lib/push';

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

type ShopCategory = 'restaurant' | 'retail' | 'salon' | 'clinic' | 'pharmacy' | 'grocery' | 'services' | 'other';

// ── Local extraction fallback — CONSERVATIVE ────────────────────────────────
function extractOrderLocal(transcript: TranscriptEntry[]): any {
  if (transcript.length === 0) return { has_order: false };
  const assistantText = transcript.filter(e => e.role === 'assistant').map(e => e.text).join(' ').toLowerCase();
  const confirmedPattern = /(your order (is|has been) confirmed|order confirmed|appointment (is )?(booked|confirmed)|booking (is )?(confirmed|done)|আপনার অর্ডার নিশ্চিত|অর্ডার কনফার্ম)/i;
  if (!confirmedPattern.test(assistantText)) return { has_order: false };
  const fullText = transcript.map(e => e.text).join(' ');
  const phoneMatch = fullText.match(/(\+?880|0)?[\s-]?(1[3-9])[\s-]?(\d{2})[\s-]?(\d{3})[\s-]?(\d{3})/);
  const customerPhone = phoneMatch ? phoneMatch[0].replace(/[\s-]/g, '') : null;
  return {
    has_order: true,
    order_type: 'order',
    customer_name: null,
    customer_phone: customerPhone,
    customer_address: null,
    items: [],
    total_amount: null,
    metadata: {},
    notes: 'Confirmed via voice (auto-fallback)',
  };
}

// ── Category-specific extraction schema instructions ──────────────────────
function schemaFor(category: ShopCategory): string {
  if (category === 'clinic') return `{
  "has_order": true|false,
  "order_type": "appointment",
  "customer_name": "patient full name or null",
  "customer_phone": "phone or null",
  "customer_address": null,
  "items": [],
  "total_amount": null,
  "metadata": {
    "doctor_name":     "Dr. X or null",
    "appointment_at":  "ISO-ish date+time string or null",
    "patient_name":    "same as customer_name or null",
    "location_name":   "clinic branch/location name mentioned, or null"
  },
  "notes": "optional or null"
}`;
  if (category === 'salon' || category === 'services') return `{
  "has_order": true|false,
  "order_type": "appointment",
  "customer_name": "customer name or null",
  "customer_phone": "phone or null",
  "customer_address": null,
  "items": [],
  "total_amount": number or null,
  "metadata": {
    "service_name": "service requested or null",
    "booking_at":   "ISO-ish date+time string or null"
  },
  "notes": "optional or null"
}`;
  // retail / restaurant / grocery / pharmacy / other
  return `{
  "has_order": true|false,
  "order_type": "order",
  "customer_name": "Real Full Name or null",
  "customer_phone": "phone or null",
  "customer_address": "address or null",
  "items": [ { "name": "product name", "quantity": 1, "unit_price": number|null } ],
  "total_amount": number or null,
  "metadata": {},
  "notes": "optional or null"
}`;
}

async function extractOrder(transcript: TranscriptEntry[], category: ShopCategory): Promise<any | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || transcript.length === 0) return null;

  const lines = transcript
    .map(e => `${e.role === 'user' ? 'Customer' : 'AI Assistant'}: ${e.text}`)
    .join('\n');

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(
`You are analyzing a voice call transcript from a shop's AI assistant.
The shop category is: ${category}.
TODAY's date is: ${new Date().toISOString().slice(0, 10)} (use this as the base year when resolving relative dates like "tomorrow", "next Monday", "আজ", "কাল").

Your job: determine whether a CONFIRMED ${category === 'clinic' ? 'appointment' : (category === 'salon' || category === 'services') ? 'booking' : 'order'} was actually placed, and if so, extract its details.

CRITICAL RULES:
1. Set "has_order": true if ANY of these conditions are met:
   a) The AI summarized the appointment details AND the customer agreed (yes / okay / correct / right / হ্যাঁ / ঠিক আছে / সঠিক).
   b) The AI clearly summarized the final appointment details (name, doctor/service, date/time, phone) — treat the AI's summary as a confirmed booking.
   c) The customer provided their name AND phone AND a date/time was mentioned.
2. Set "has_order": false ONLY if the customer explicitly declined, said "no thanks", or the call ended with no details collected at all.
3. Never invent data. Use null when unsure.
4. Customer name must be a REAL human name.
5. Phone numbers must have 4+ digits.
6. For appointment_at: ALWAYS use the current year (${new Date().getFullYear()}) unless the transcript explicitly states a different year. Convert relative dates ("আজ"=today, "কাল"=tomorrow, "পরশু"=day after tomorrow) using TODAY's date above.

Return ONLY a raw JSON object — no markdown fences, no explanation.

JSON structure:
${schemaFor(category)}

Transcript:
${lines}`
    );

    const raw = result.response.text()?.trim() ?? '';
    const json = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(json);
    console.log('[save-session] gemini extraction result:', JSON.stringify(parsed));
    return parsed;
  } catch (e: any) {
    console.error('[save-session] gemini extraction failed:', e?.message ?? e);
    return extractOrderLocal(transcript);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { shopId, duration, transcript, endReason, offTopicCount, source, callerDid, leadId, leadPhone } = await req.json();
    if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

    const sourceClean: 'widget' | 'voice_link' | 'phone' =
      source === 'phone' || source === 'voice_link' ? source : 'widget';

    console.log(`[save-session] shopId=${shopId} duration=${duration} entries=${transcript?.length ?? 0} reason=${endReason ?? 'unknown'} offTopic=${offTopicCount ?? 0} source=${sourceClean}${callerDid ? ` did=${callerDid}` : ''}`);

    const db = createAdminClient();

    // Load shop category for category-aware extraction
    const { data: shop } = await (db as any).from('shops').select('category').eq('id', shopId).single();
    const category: ShopCategory = (shop?.category ?? 'other') as ShopCategory;

    // 1. Save voice_session row
    const sessionToken = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const transcriptRows = (transcript ?? []).map((e: TranscriptEntry) => ({
      role: e.role, text: e.text, timestamp: e.timestamp,
    }));

    // Pre-calculate archival date: 7 days from now (for non-order sessions)
    const archivalDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: voiceSession, error: vsError } = await (db as any)
      .from('voice_sessions')
      .insert({
        shop_id:       shopId,
        session_token: sessionToken,
        status:        'ended',
        duration_s:    duration ?? 0,
        transcript:    transcriptRows,
        end_reason:    endReason ?? 'completed',
        off_topic_count: offTopicCount ?? 0,
        order_linked:  false,  // set to true below if order is created
        archived_at:   archivalDate,  // default 7-day expiry (overridden if order created)
        source:        sourceClean,
        caller_did:    callerDid ?? null,
      })
      .select('id')
      .single();

    if (vsError) console.error('[save-session] voice_session error:', vsError.message);

    const sessionId = voiceSession?.id ?? null;

    // NOTE: calls_used is now incremented atomically at call START in check-limit.
    // We only need to update minutes_used here (duration isn't known until call ends).
    if (duration && duration > 0) {
      const minutesIncrement = Math.ceil(duration / 60);
      try {
        const { data: sub } = await (db as any)
          .from('subscriptions')
          .select('id, minutes_used')
          .eq('shop_id', shopId)
          .maybeSingle();

        if (sub?.id) {
          await (db as any)
            .from('subscriptions')
            .update({ minutes_used: (sub.minutes_used ?? 0) + minutesIncrement })
            .eq('id', sub.id);
          console.log(`[save-session] updated minutes_used: +${minutesIncrement}m (total: ${(sub.minutes_used ?? 0) + minutesIncrement}m)`);
        }
      } catch (err: any) {
        console.error('[save-session] failed to update minutes_used:', err.message);
      }
    }

    // 2. Extract order (category-aware)
    const extracted = await extractOrder(transcript ?? [], category);

    if (!extracted?.has_order) {
      console.log(`[save-session] no order in session ${sessionId}`);
      return NextResponse.json({ sessionId, hasOrder: false });
    }

    // 3. Find or create customer
    let customerId: string | null = null;
    const hasPhone = !!(extracted.customer_phone?.trim());
    const hasName  = !!(extracted.customer_name?.trim());

    const isAppointmentCategory = category === 'clinic' || category === 'salon' || category === 'services';

    // Require at least a name OR phone — don't create ghost records
    if (!hasPhone && !hasName) {
      console.log(`[save-session] no customer info collected, skipping order save`);
      return NextResponse.json({ sessionId, hasOrder: false, reason: 'no_customer_info' });
    }

    // Appointments specifically need a patient/customer name — a phone alone isn't enough
    if (isAppointmentCategory && !hasName) {
      console.log(`[save-session] appointment with no name collected, skipping order save`);
      return NextResponse.json({ sessionId, hasOrder: false, reason: 'no_customer_name' });
    }

    if (hasPhone) {
      const { data: existing } = await (db as any)
        .from('customers')
        .select('id, order_count, lifetime_value')
        .eq('shop_id', shopId)
        .eq('phone', extracted.customer_phone.trim())
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
        await (db as any).from('customers').update({
          order_count:    (existing.order_count ?? 0) + 1,
          lifetime_value: (existing.lifetime_value ?? 0) + (extracted.total_amount ?? 0),
          ...(hasName    ? { name:    extracted.customer_name.trim() }    : {}),
          ...(extracted.customer_address ? { address: extracted.customer_address } : {}),
        }).eq('id', customerId);
      }
    }

    if (!customerId && (hasName || hasPhone)) {
      const customerName = hasName ? extracted.customer_name.trim() : extracted.customer_phone;
      const { data: newCustomer, error: custErr } = await (db as any)
        .from('customers')
        .insert({
          shop_id:        shopId,
          name:           customerName,
          phone:          extracted.customer_phone ?? null,
          address:        extracted.customer_address ?? null,
          order_count:    1,
          lifetime_value: extracted.total_amount ?? 0,
        })
        .select('id')
        .single();

      if (custErr) console.error('[save-session] customer insert error:', custErr.message);
      else customerId = newCustomer?.id ?? null;
    }

    // 4. Build readable notes (for legacy display fallback)
    const noteParts = [
      hasName               ? `Name: ${extracted.customer_name}`    : null,
      hasPhone              ? `Phone: ${extracted.customer_phone}`   : null,
      extracted.customer_address ? `Address: ${extracted.customer_address}` : null,
      extracted.metadata?.doctor_name    ? `Doctor: ${extracted.metadata.doctor_name}`        : null,
      extracted.metadata?.location_name  ? `Location: ${extracted.metadata.location_name}`    : null,
      extracted.metadata?.appointment_at ? `Appointment: ${extracted.metadata.appointment_at}` : null,
      extracted.metadata?.service_name   ? `Service: ${extracted.metadata.service_name}`      : null,
      extracted.metadata?.booking_at     ? `Booking: ${extracted.metadata.booking_at}`        : null,
      extracted.notes       ? extracted.notes                        : null,
    ].filter(Boolean);

    // 5. Create order — no 'metadata' column in DB; store appointment details in items
    const inferredType =
      category === 'clinic' ? 'appointment' :
      (category === 'salon' || category === 'services') ? 'appointment' :
      (extracted.order_type ?? 'order');

    // For appointments, pack doctor/date/service into items so it's structured + queryable
    let orderItems = extracted.items?.length > 0 ? extracted.items : [];
    if (inferredType === 'appointment' && extracted.metadata) {
      const m = extracted.metadata;
      orderItems = [{
        name:           m.doctor_name ?? m.service_name ?? 'Appointment',
        appointment_at: m.appointment_at ?? m.booking_at ?? null,
        doctor_name:    m.doctor_name ?? null,
        service_name:   m.service_name ?? null,
        quantity:       1,
        unit_price:     null,
      }];
    }

    // Resolve clinic location name → id (best-effort, case-insensitive match)
    let locationId: string | null = null;
    const locationName: string | undefined = extracted.metadata?.location_name;
    if (category === 'clinic' && locationName) {
      const { data: locs } = await (db as any)
        .from('clinic_locations')
        .select('id, name')
        .eq('shop_id', shopId);
      const match = (locs ?? []).find((l: any) => l.name.toLowerCase().trim() === locationName.toLowerCase().trim())
        ?? (locs ?? []).find((l: any) => l.name.toLowerCase().includes(locationName.toLowerCase()));
      locationId = match?.id ?? null;
    }

    const { data: order, error: orderError } = await (db as any)
      .from('orders')
      .insert({
        shop_id:      shopId,
        customer_id:  customerId,
        session_id:   sessionId,
        type:         inferredType,
        status:       'pending',
        items:        orderItems,
        total_amount: extracted.total_amount ?? null,
        location_id:  locationId,
        metadata:     { source: sourceClean },
        notes:        noteParts.join(' | ') || null,
      })
      .select('*')
      .single();

    if (orderError) {
      console.error('[save-session] order insert error:', orderError.message);
      return NextResponse.json({ sessionId, hasOrder: true, orderId: null, error: orderError.message });
    }

    console.log(`[save-session] ✅ order created: ${order?.id}`);

    // Fire webhook so external systems (e.g. WordPress/WooCommerce, Amelia) sync.
    dispatchWebhook(shopId, inferredType === 'appointment' ? 'appointment.created' : 'order.created', order);

    const customerLabel = extracted.customer_name?.trim() || extracted.customer_phone?.trim() || 'Unknown';
    sendPushNotification({
      shopId,
      title: 'KothaBot',
      body:  `New ${inferredType === 'appointment' ? 'appointment' : 'order'} from ${customerLabel}`,
      url:   `/orders/${order.id}`,
      tag:   `order-${order.id}`,
    }).catch(() => {});

    // ── Link lead → mark as ordered/booked, fill in name ──
    try {
      const phoneForLead = leadPhone || extracted.customer_phone?.trim() || (sourceClean === 'phone' ? callerDid : null);
      if (leadId || phoneForLead) {
        const patch: any = {
          updated_at: new Date().toISOString(),
          [inferredType === 'appointment' ? 'has_booked' : 'has_ordered']: true,
        };
        if (extracted.customer_name?.trim()) patch.name = extracted.customer_name.trim();

        if (leadId) {
          await (db as any).from('leads').update(patch).eq('id', leadId);
        } else if (phoneForLead) {
          // upsert — phone-call leads may not exist yet
          await (db as any).from('leads').upsert(
            { shop_id: shopId, phone: phoneForLead, source: sourceClean === 'phone' ? 'phone_sip' : 'widget_voice', ...patch },
            { onConflict: 'shop_id,phone' }
          );
        }
      }
    } catch (leadErr: any) {
      console.warn('[save-session] lead link failed:', leadErr?.message);
    }

    // ── Mark session as order-linked (keep forever, no archival) ──
    if (sessionId) {
      await (db as any)
        .from('voice_sessions')
        .update({ order_linked: true, archived_at: null })
        .eq('id', sessionId)
        .catch((e: any) => console.warn('[save-session] failed to mark order_linked:', e?.message));
    }

    return NextResponse.json({ sessionId, hasOrder: true, orderId: order?.id ?? null, customerId });

  } catch (err: any) {
    console.error('[save-session] unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
