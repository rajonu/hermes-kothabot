/**
 * GET /api/scheduling/session-key
 * Returns the shop's first active API key (raw prefix shown) for use in the
 * scheduling settings dashboard UI. Only works for authenticated shop owners.
 *
 * ponytail: we only need the raw key for the settings UI's direct v1 calls.
 * The dashboard settings page uses the user's Supabase session, but v1 routes
 * need the Bearer key. This endpoint bridges that gap without exposing the hash.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Return the key_prefix (first 20 chars, shown in dashboard) — not enough to auth
  // The settings UI must use the dashboard's internal /api/scheduling/* routes instead
  // for mutations. This endpoint is a placeholder; the UI now uses /api/scheduling/links.
  const db = createAdminClient();
  const { data: key } = await (db as any)
    .from('api_keys')
    .select('key_prefix, type')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .single();

  return NextResponse.json({ prefix: key?.key_prefix ?? null, type: key?.type ?? null });
}
