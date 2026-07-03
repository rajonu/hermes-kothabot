import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchWebhook } from '@/lib/webhook-delivery';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const phone = searchParams.get('phone');
    const search = searchParams.get('search');

    const supabase = createAdminClient();
    let q = (supabase as any)
      .from('customers')
      .select('id, name, phone, address, lifetime_value, order_count, created_at', { count: 'exact' })
      .eq('shop_id', ctx.shopId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (phone) q = q.eq('phone', phone);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

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
    if (!body?.name && !body?.phone) {
      return NextResponse.json({ error: 'name or phone required' }, { status: 422 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('customers')
      .insert({
        shop_id: ctx.shopId,
        name: body.name?.trim() ?? body.phone?.trim(),
        phone: body.phone?.trim() ?? null,
        address: body.address?.trim() ?? null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    dispatchWebhook(ctx.shopId, 'customer.created', data);
    return NextResponse.json({ data }, { status: 201 });
  });
}
