import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

async function getShopId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  return shop?.id ?? null;
}

export async function GET() {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data } = await (db as any)
    .from('webhook_endpoints')
    .select('id, url, events, is_active, created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ webhooks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body?.url) return NextResponse.json({ error: 'url required' }, { status: 422 });

  const ALL_EVENTS = [
    'order.created', 'order.updated', 'appointment.created', 'appointment.updated',
    'customer.created', 'customer.updated', 'support.created', 'support.updated',
  ];

  const secret = `whsec_${randomBytes(32).toString('hex')}`;
  const db = createAdminClient();
  const { data, error } = await (db as any)
    .from('webhook_endpoints')
    .insert({ shop_id: shopId, url: body.url, events: body.events ?? ALL_EVENTS, secret })
    .select('id, url, events, is_active, created_at, secret')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhook: data }, { status: 201 });
}
