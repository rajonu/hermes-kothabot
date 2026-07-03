/**
 * GET  /api/v1/webhooks  — list webhook endpoints
 * POST /api/v1/webhooks  — register a new endpoint
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

const ALL_EVENTS = [
  'appointment.created', 'appointment.updated',
  'order.created', 'order.updated',
  'customer.created', 'customer.updated',
  'support.created', 'support.updated',
];

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('webhook_endpoints')
      .select('id, url, events, is_active, created_at')
      .eq('shop_id', ctx.shopId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.url) return NextResponse.json({ error: 'url required' }, { status: 422 });

    let url: URL;
    try { url = new URL(body.url); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 422 });
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      return NextResponse.json({ error: 'URL must use http or https' }, { status: 422 });
    }

    const events: string[] = Array.isArray(body.events) ? body.events : ALL_EVENTS;
    const invalidEvents = events.filter(e => !ALL_EVENTS.includes(e) && e !== '*');
    if (invalidEvents.length) {
      return NextResponse.json({ error: `Invalid events: ${invalidEvents.join(', ')}`, valid_events: ALL_EVENTS }, { status: 422 });
    }

    const secret = `whsec_${randomBytes(32).toString('hex')}`;
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('webhook_endpoints')
      .insert({ shop_id: ctx.shopId, url: body.url, events, secret })
      .select('id, url, events, is_active, created_at, secret')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data,
      note: 'Save the secret — it will not be shown again. Use it to verify webhook signatures.',
    }, { status: 201 });
  });
}
