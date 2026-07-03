/**
 * Order/appointment extraction from a chat transcript.
 * Extracted from app/api/widget-chat/route.ts (behavior-preserving) so the
 * omnichannel routing engine (Messenger/WhatsApp) can save orders/appointments
 * through the exact same logic instead of duplicating the prompt/schema.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dispatchWebhook } from '@/lib/webhook-delivery';
import { sendPushNotification } from '@/lib/push';

export type ShopCategory = 'restaurant' | 'retail' | 'salon' | 'clinic' | 'pharmacy' | 'grocery' | 'services' | 'other';

const CONFIRMATION_PATTERNS = [
  /appointment.*confirm/i, /booking.*confirm/i, /confirmed.*appointment/i,
  /order.*confirm/i, /confirmed.*order/i,
  /your appointment/i, /appointment.*booked/i,
  /look forward to seeing you/i, /see you then/i,
  /অ্যাপয়েন্টমেন্ট.*নিশ্চিত/i, /বুকিং.*নিশ্চিত/i, /অর্ডার.*নিশ্চিত/i,
];

export function isConfirmed(text: string): boolean {
  return CONFIRMATION_PATTERNS.some(p => p.test(text));
}

function schemaFor(category: ShopCategory): string {
  if (category === 'clinic') return `{
  "has_order": true,
  "order_type": "appointment",
  "customer_name": "patient full name or null",
  "customer_phone": "phone or null",
  "customer_address": null,
  "items": [],
  "total_amount": null,
  "metadata": {
    "doctor_name": "Dr. X or null",
    "appointment_at": "ISO-ish date+time string or null",
    "patient_name": "same as customer_name or null"
  },
  "notes": null
}`;
  if (category === 'salon' || category === 'services') return `{
  "has_order": true,
  "order_type": "appointment",
  "customer_name": "customer name or null",
  "customer_phone": "phone or null",
  "customer_address": null,
  "items": [],
  "total_amount": null,
  "metadata": {
    "service_name": "service requested or null",
    "booking_at": "ISO-ish date+time string or null"
  },
  "notes": null
}`;
  return `{
  "has_order": true,
  "order_type": "order",
  "customer_name": "Real Full Name or null",
  "customer_phone": "phone or null",
  "customer_address": "address or null",
  "items": [{ "name": "product name", "quantity": 1, "unit_price": null }],
  "total_amount": null,
  "metadata": {},
  "notes": null
}`;
}

/**
 * Extracts a confirmed order/appointment from `history` and saves it
 * (customers, orders, webhook dispatch, push notification, lead linking).
 * `source` is stored in orders.metadata.source for provenance (e.g.
 * 'widget_chat', 'facebook', 'whatsapp').
 */
export async function extractAndSaveOrder(
  shopId: string,
  category: ShopCategory,
  history: { role: string; text: string }[],
  db: any,
  source: string,
  leadId?: string | null,
  leadPhone?: string | null
): Promise<void> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    const lines = history.map(m => `${m.role === 'user' ? 'Customer' : 'AI Assistant'}: ${m.text}`).join('\n');
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent(
`You are analyzing a text chat transcript from a shop's AI assistant.
Shop category: ${category}
TODAY's date: ${new Date().toISOString().slice(0, 10)}

Extract the confirmed ${category === 'clinic' ? 'appointment' : 'order/booking'} details from this conversation.
Return ONLY a raw JSON object — no markdown, no explanation.

JSON structure:
${schemaFor(category)}

Transcript:
${lines}`
    );

    const raw = result.response.text()?.trim() ?? '';
    const json = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const extracted = JSON.parse(json);

    if (!extracted?.has_order) return;

    // Require at least name OR phone — no ghost records
    const hasNameCheck  = !!(extracted.customer_name?.trim());
    const hasPhoneCheck = !!(extracted.customer_phone?.trim());
    if (!hasNameCheck && !hasPhoneCheck) {
      console.log(`[${source}] no customer info, skipping save`);
      return;
    }

    const hasPhone = !!(extracted.customer_phone?.trim());
    const hasName  = !!(extracted.customer_name?.trim());

    // Find or create customer
    let customerId: string | null = null;
    if (hasPhone) {
      const { data: existing } = await db.from('customers').select('id, order_count, lifetime_value')
        .eq('shop_id', shopId).eq('phone', extracted.customer_phone.trim()).maybeSingle();
      if (existing) {
        customerId = existing.id;
        await db.from('customers').update({
          order_count:    (existing.order_count ?? 0) + 1,
          lifetime_value: (existing.lifetime_value ?? 0) + (extracted.total_amount ?? 0),
          ...(hasName ? { name: extracted.customer_name.trim() } : {}),
        }).eq('id', customerId);
      }
    }
    if (!customerId && (hasName || hasPhone)) {
      const { data: newCustomer } = await db.from('customers').insert({
        shop_id:        shopId,
        name:           hasName ? extracted.customer_name.trim() : extracted.customer_phone,
        phone:          extracted.customer_phone ?? null,
        address:        extracted.customer_address ?? null,
        order_count:    1,
        lifetime_value: extracted.total_amount ?? 0,
      }).select('id').single();
      customerId = newCustomer?.id ?? null;
    }

    // Build notes
    const noteParts = [
      hasName  ? `Name: ${extracted.customer_name}` : null,
      hasPhone ? `Phone: ${extracted.customer_phone}` : null,
      extracted.customer_address ? `Address: ${extracted.customer_address}` : null,
      extracted.metadata?.doctor_name    ? `Doctor: ${extracted.metadata.doctor_name}` : null,
      extracted.metadata?.appointment_at ? `Appointment: ${extracted.metadata.appointment_at}` : null,
      extracted.metadata?.service_name   ? `Service: ${extracted.metadata.service_name}` : null,
      extracted.metadata?.booking_at     ? `Booking: ${extracted.metadata.booking_at}` : null,
    ].filter(Boolean);

    const inferredType = (category === 'clinic' || category === 'salon' || category === 'services')
      ? 'appointment' : (extracted.order_type ?? 'order');

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

    // Check if an order for this customer was already saved within last 10 min
    // (avoid duplicates from race conditions or repeated confirmation messages).
    // No status filter — even confirmed orders block re-creation.
    if (customerId) {
      const { data: recent } = await db.from('orders')
        .select('id').eq('shop_id', shopId).eq('customer_id', customerId)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .limit(1);
      if (recent && recent.length > 0) {
        console.log(`[${source}] duplicate within 10 min, skipping`);
        return;
      }
    }

    const { data: order, error: orderErr } = await db.from('orders').insert({
      shop_id:      shopId,
      customer_id:  customerId,
      type:         inferredType,
      status:       'pending',
      items:        orderItems,
      total_amount: extracted.total_amount ?? null,
      metadata:     { source },
      notes:        noteParts.join(' | ') || null,
    }).select('*').single();

    if (orderErr) {
      console.error(`[${source}] order insert error:`, orderErr.message);
      return;
    }

    console.log(`[${source}] ✅ appointment/order saved for shop ${shopId}`);

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

    // ── Link lead → mark as ordered/booked, fill in name if extracted ──
    try {
      if (leadId || leadPhone) {
        const patch: any = {
          updated_at: new Date().toISOString(),
          [inferredType === 'appointment' ? 'has_booked' : 'has_ordered']: true,
        };
        if (extracted.customer_name?.trim()) patch.name = extracted.customer_name.trim();

        if (leadId) {
          await db.from('leads').update(patch).eq('id', leadId);
        } else if (leadPhone) {
          await db.from('leads').update(patch).eq('shop_id', shopId).eq('phone', leadPhone);
        }
      }
    } catch (leadErr: any) {
      console.warn(`[${source}] lead link failed:`, leadErr?.message);
    }
  } catch (e: any) {
    console.error(`[${source}] extraction/save error:`, e?.message);
  }
}
