import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, region } = await req.json();
  if (!shopId || !['BD', 'INTL'].includes(region)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const db = createAdminClient();

  // Read existing ai_config and merge billing_region into it
  const { data: shop } = await (db as any)
    .from('shops').select('ai_config').eq('id', shopId).single();

  const existingConfig = shop?.ai_config ?? {};

  const { error } = await (db as any)
    .from('shops')
    .update({ ai_config: { ...existingConfig, billing_region: region } })
    .eq('id', shopId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
