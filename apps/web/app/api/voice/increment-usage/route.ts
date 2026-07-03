import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { shopId, durationSeconds } = await req.json();
    if (!shopId) {
      return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: subscription, error: subError } = await (db as any)
      .from('subscriptions')
      .select('id, calls_used, minutes_used, current_period_end')
      .eq('shop_id', shopId)
      .single();

    if (subError || !subscription) {
      console.warn('[increment-usage] no subscription found for shopId:', shopId);
      return NextResponse.json({ ok: false, reason: 'no_subscription' });
    }

    const minutesIncrement = Math.ceil((durationSeconds ?? 0) / 60);
    const now = new Date();
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

    // If billing period has passed, reset usage and start fresh
    const periodExpired = periodEnd && periodEnd < now;

    const updatePayload = periodExpired
      ? {
          calls_used:    1,
          minutes_used:  minutesIncrement,
          last_reset_at: now.toISOString(),
        }
      : {
          calls_used:   (subscription.calls_used ?? 0) + 1,
          minutes_used: (subscription.minutes_used ?? 0) + minutesIncrement,
        };

    const { error: updateError } = await (db as any)
      .from('subscriptions')
      .update(updatePayload)
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[increment-usage] update error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reset: !!periodExpired });
  } catch (err: any) {
    console.error('[increment-usage] unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
