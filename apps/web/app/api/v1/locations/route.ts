/**
 * GET  /api/v1/locations  — list clinic locations
 * POST /api/v1/locations  — create location
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const db = createAdminClient();
    const { data, error } = await (db as any)
      .from('clinic_locations')
      .select('id, name, address, phone, status, sort_order, created_at')
      .eq('shop_id', ctx.shopId)
      .order('sort_order');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.name) return NextResponse.json({ error: 'name is required' }, { status: 422 });

    const db = createAdminClient();
    const { data, error } = await (db as any)
      .from('clinic_locations')
      .insert({
        shop_id:    ctx.shopId,
        name:       body.name,
        address:    body.address ?? null,
        phone:      body.phone ?? null,
        status:     body.status ?? 'active',
        sort_order: body.sort_order ?? 0,
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  });
}
