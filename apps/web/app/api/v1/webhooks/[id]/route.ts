import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const supabase = createAdminClient();
    const { error } = await (supabase as any)
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)
      .eq('shop_id', ctx.shopId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const updates: Record<string, any> = {};
    if ('is_active' in body) updates.is_active = Boolean(body.is_active);
    if ('events' in body && Array.isArray(body.events)) updates.events = body.events;
    if ('url' in body) updates.url = body.url;
    updates.updated_at = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('webhook_endpoints')
      .update(updates)
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .select('id, url, events, is_active, updated_at')
      .single();

    if (error || !data) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    return NextResponse.json({ data });
  });
}
