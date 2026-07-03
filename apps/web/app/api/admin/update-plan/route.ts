import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';
import { getPlatformSettings } from '@/lib/platform-settings';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, plan, callLimitOverride, minuteLimitOverride } = await req.json();
  if (!shopId || !plan) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = createAdminClient();

  const settings = await getPlatformSettings();
  const planRow = settings.plans[plan as keyof typeof settings.plans];
  const planCallLimit   = planRow?.call_limit   ?? 30;
  const planMinuteLimit = planRow?.minute_limit ?? planCallLimit;

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + (plan === 'trial' ? 14 : 30));

  const upsertData: any = {
    shop_id:            shopId,
    plan_id:            plan,
    plan:               plan === 'trial' ? 'trial' : 'monthly',
    status:             plan === 'trial' ? 'trial' : 'active',
    current_period_end: periodEnd.toISOString(),
  };

  // Overrides are stored as deltas from the current plan's defaults so that
  // check-limit can compute: total_allowed = plan.limit + extra. We read the
  // *current* plan limit from settings rather than hardcoding it — otherwise
  // changing trial.call_limit in settings desyncs every existing override.
  if (typeof callLimitOverride === 'number' && callLimitOverride > 0 && planCallLimit !== -1) {
    upsertData.extra_calls = callLimitOverride - planCallLimit;
  }
  if (typeof minuteLimitOverride === 'number' && minuteLimitOverride > 0 && planMinuteLimit !== -1) {
    upsertData.extra_minutes = minuteLimitOverride - planMinuteLimit;
  }

  upsertData.calls_used = 0;
  upsertData.minutes_used = 0;
  upsertData.last_reset_at = new Date().toISOString();

  const { error } = await (db as any)
    .from('subscriptions')
    .upsert(upsertData, { onConflict: 'shop_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
