/**
 * GET    /api/v1/locations/[id]
 * PUT    /api/v1/locations/[id]
 * DELETE /api/v1/locations/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withApiAuth(req, async (ctx) => {
    const db = createAdminClient();
    const { data, error } = await (db as any)
      .from('clinic_locations')
      .select('*')
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 });

    const allowed = ['name', 'address', 'phone', 'status', 'sort_order'];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) update[k] = body[k];

    const db = createAdminClient();
    const { data, error } = await (db as any)
      .from('clinic_locations')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .select('*')
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withApiAuth(req, async (ctx) => {
    const db = createAdminClient();
    const { error } = await (db as any)
      .from('clinic_locations')
      .delete()
      .eq('id', id)
      .eq('shop_id', ctx.shopId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
