import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, planId, days } = await req.json();
  if (!shopId || !planId || !days) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = createAdminClient();

  // Get current end date or use today
  const { data: existing } = await (db as any)
    .from('subscriptions').select('current_period_end').eq('shop_id', shopId).single();

  const base = existing?.current_period_end
    ? new Date(Math.max(new Date(existing.current_period_end).getTime(), Date.now()))
    : new Date();

  base.setDate(base.getDate() + Number(days));

  const { error } = await (db as any)
    .from('subscriptions')
    .upsert({
      shop_id:            shopId,
      plan_id:            planId,
      status:             planId === 'trial' ? 'trialing' : 'active',
      current_period_end: base.toISOString(),
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'shop_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
