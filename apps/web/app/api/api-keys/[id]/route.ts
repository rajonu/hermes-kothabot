import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/api-auth';

async function getShopId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  return shop?.id ?? null;
}

/** DELETE — revoke (disable) an active key */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const db = createAdminClient();
  const { error } = await (db as any)
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'revoked' });
}

/** PATCH — hard delete a revoked key permanently */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const db = createAdminClient();

  // Only allow deleting revoked (inactive) keys
  const { data: key } = await (db as any)
    .from('api_keys')
    .select('id, is_active')
    .eq('id', id)
    .eq('shop_id', shopId)
    .single();

  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  if ((key as any).is_active) {
    return NextResponse.json({ error: 'Revoke the key before deleting it.' }, { status: 422 });
  }

  const { error } = await (db as any)
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'deleted' });
}

/** POST /api/api-keys/[id]/regenerate — create a new key of same type, disable the old one */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const db = createAdminClient();
  const { data: old } = await (db as any)
    .from('api_keys')
    .select('id, type, name')
    .eq('id', id)
    .eq('shop_id', shopId)
    .single();

  if (!old) return NextResponse.json({ error: 'Key not found' }, { status: 404 });

  // Disable old key
  await (db as any).from('api_keys').update({ is_active: false }).eq('id', id);

  // Create replacement
  const { raw, hash, prefix } = generateApiKey((old as any).type);
  const { data: newKey, error } = await (db as any)
    .from('api_keys')
    .insert({ shop_id: shopId, name: (old as any).name, key_prefix: prefix, key_hash: hash, type: (old as any).type })
    .select('id, name, key_prefix, type, is_active, request_count, last_used_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    key: { ...newKey, raw_key: raw },
    warning: 'Copy this key now — it will never be shown again.',
  }, { status: 201 });
}
