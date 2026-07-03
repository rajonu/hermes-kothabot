/**
 * Internal API: manage API keys for the authenticated dashboard user.
 * GET  — list keys for the shop (hashes not exposed)
 * POST — generate a new key (raw key returned ONCE)
 */
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

export async function GET() {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await (db as any)
    .from('api_keys')
    .select('id, name, key_prefix, type, is_active, last_used_at, request_count, created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

const MAX_KEYS = 4;

export async function POST(req: NextRequest) {
  const shopId = await getShopId();
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();

  // Enforce maximum key limit (active keys only)
  const { count } = await (db as any)
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_active', true);

  if ((count ?? 0) >= MAX_KEYS) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_KEYS} active API keys allowed. Revoke an existing key first.` },
      { status: 422 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const type: 'test' | 'live' = body.type === 'live' ? 'live' : 'test';
  const name: string = body.name?.trim() || (type === 'live' ? 'Live Key' : 'Test Key');

  const { raw, hash, prefix } = generateApiKey(type);

  const { data, error } = await (db as any)
    .from('api_keys')
    .insert({ shop_id: shopId, name, key_prefix: prefix, key_hash: hash, type })
    .select('id, name, key_prefix, type, is_active, request_count, last_used_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    key: { ...data, raw_key: raw },
    warning: 'Copy this key now — it will never be shown again.',
  }, { status: 201 });
}
