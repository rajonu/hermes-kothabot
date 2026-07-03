import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get('shop_id');

  const db = createAdminClient();
  let q = (db as any)
    .from('api_keys')
    .select('id, shop_id, name, key_prefix, type, is_active, last_used_at, request_count, created_at, shops(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (shopId) q = q.eq('shop_id', shopId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

/** PATCH /api/admin/api-keys — disable/enable a key by id */
export async function PATCH(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { id, is_active } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 422 });

  const db = createAdminClient();
  const { error } = await (db as any).from('api_keys').update({ is_active: Boolean(is_active) }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
