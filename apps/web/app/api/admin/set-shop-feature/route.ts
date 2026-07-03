import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

// Generic admin toggle for ai_config boolean flags: white_label, voip_enabled,
// api_access_enabled, etc. Whitelisted to prevent arbitrary writes.
const ALLOWED_FLAGS = new Set([
  'voip_enabled',
  'api_access_enabled',
  'white_label',
]);

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, flag, enabled } = await req.json();
  if (!shopId || !ALLOWED_FLAGS.has(flag) || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: shop } = await (db as any)
    .from('shops').select('ai_config').eq('id', shopId).single();

  const existingConfig = shop?.ai_config ?? {};

  const { error } = await (db as any)
    .from('shops')
    .update({ ai_config: { ...existingConfig, [flag]: enabled } })
    .eq('id', shopId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
