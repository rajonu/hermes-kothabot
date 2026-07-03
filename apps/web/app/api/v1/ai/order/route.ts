/**
 * POST /api/v1/ai/order
 * Submit a conversation transcript; AI extracts and saves an order/appointment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dispatchWebhook } from '@/lib/webhook-delivery';

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.transcript && !body?.message) {
      return NextResponse.json({ error: 'transcript or message required' }, { status: 422 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const db = createAdminClient();
    const { data: shopRaw } = await (db as any).from('shops').select('id, name, category').eq('id', ctx.shopId).single();
    if (!shopRaw) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    const shop = shopRaw as any;

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const text = body.transcript ?? body.message;
    const result = await model.generateContent(
      `Extract order/appointment details from this text for a ${shop.category} business.
Return ONLY raw JSON (no markdown).
{
  "has_order": true/false,
  "customer_name": "...",
  "customer_phone": "...",
  "customer_address": "...",
  "order_type": "order|appointment",
  "items": [{"name":"...","quantity":1,"unit_price":null}],
  "total_amount": null,
  "metadata": {},
  "notes": null
}
Text: ${text}`
    );

    const raw = result.response.text()?.trim() ?? '';
    let extracted: any;
    try {
      extracted = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim());
    } catch {
      return NextResponse.json({ error: 'AI failed to extract order details' }, { status: 422 });
    }

    if (!extracted?.has_order) {
      return NextResponse.json({ extracted, saved: false });
    }

    let customerId: string | null = null;
    if (extracted.customer_phone) {
      const { data: existing } = await (db as any).from('customers').select('id')
        .eq('shop_id', ctx.shopId).eq('phone', extracted.customer_phone.trim()).maybeSingle();
      if (existing) {
        customerId = existing.id;
      } else {
        const { data: created } = await (db as any).from('customers').insert({
          shop_id: ctx.shopId,
          name: extracted.customer_name?.trim() || extracted.customer_phone,
          phone: extracted.customer_phone.trim(),
          address: extracted.customer_address ?? null,
        }).select('id').single();
        customerId = created?.id ?? null;
      }
    }

    const { data: order, error } = await (db as any).from('orders').insert({
      shop_id: ctx.shopId,
      customer_id: customerId,
      type: extracted.order_type ?? 'order',
      status: 'pending',
      items: extracted.items ?? [],
      total_amount: extracted.total_amount ?? null,
      metadata: extracted.metadata ?? {},
      notes: extracted.notes ?? null,
    }).select('*').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const event = (extracted.order_type === 'appointment') ? 'appointment.created' : 'order.created';
    dispatchWebhook(ctx.shopId, event, order);

    return NextResponse.json({ extracted, order, saved: true }, { status: 201 });
  });
}
