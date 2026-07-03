import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchWebhook } from '@/lib/webhook-delivery';
import { sendPushNotification } from '@/lib/push';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const supabase = createAdminClient();
    let q = (supabase as any)
      .from('orders')
      .select('id, type, status, items, total_amount, notes, metadata, customer_id, created_at', { count: 'exact' })
      .eq('shop_id', ctx.shopId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) q = q.eq('status', status);
    if (type) q = q.eq('type', type);

    const { data, error, count } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data,
      meta: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('orders')
      .insert({
        shop_id: ctx.shopId,
        customer_id: body.customer_id ?? null,
        type: body.type ?? 'order',
        status: body.status ?? 'pending',
        items: Array.isArray(body.items) ? body.items : [],
        total_amount: body.total_amount ?? null,
        metadata: body.metadata ?? {},
        notes: body.notes ?? null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // ponytail: skip webhook if order originated from an external system to prevent echo loops
    if (!body.metadata?._kothabot_origin) {
      dispatchWebhook(ctx.shopId, 'order.created', data);
      sendPushNotification({
        shopId: ctx.shopId,
        title:  'KothaBot',
        body:   `New order from ${data.notes?.split('Name: ')[1]?.split(' |')[0] ?? 'a customer'}`,
        url:    `/orders/${data.id}`,
        tag:    `order-${data.id}`,
      }).catch(() => {});
    }
    return NextResponse.json({ data }, { status: 201 });
  });
}
