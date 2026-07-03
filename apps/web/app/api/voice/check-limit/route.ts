import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getPlatformSettings } from '@/lib/platform-settings';

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId');
  if (!shopId) {
    return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });
  }

  try {
    const db = createAdminClient();

    let { data: subscription, error: subError } = await (db as any)
      .from('subscriptions')
      .select('id, plan_id, status, current_period_end, calls_used, extra_calls, minutes_used, extra_minutes')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (subError || !subscription) {
      console.log(`[check-limit] Auto-creating missing subscription for shopId=${shopId}`);
      const { data: newSub, error: insertError } = await (db as any)
        .from('subscriptions')
        .insert({
          shop_id: shopId,
          plan_id: 'trial',
          plan: 'monthly',
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id, plan_id, status, current_period_end, calls_used, extra_calls, minutes_used, extra_minutes')
        .maybeSingle();

      if (insertError || !newSub) {
        console.error('[check-limit] failed to auto-create subscription:', insertError?.message);
        // Fallback: allow call but usage won't be saved
        return NextResponse.json({ allowed: true, used: 0, limit: 100, remaining: 100, planId: 'trial', maxCallSeconds: 180 });
      }
      subscription = newSub;
    }

    // Check subscription status
    if (subscription.status === 'past_due') {
      return NextResponse.json({
        allowed: false,
        reason: 'unpaid_subscription',
        used: subscription.calls_used ?? 0,
        limit: 0,
        remaining: 0,
      });
    }

    // Check subscription expiry
    if (subscription.current_period_end) {
      const expiry = new Date(subscription.current_period_end);
      if (expiry < new Date()) {
        return NextResponse.json({
          allowed: false,
          reason: 'subscription_expired',
          used: subscription.calls_used ?? 0,
          limit: 0,
          remaining: 0,
        });
      }
    }

    // Get plan limits from platform settings
    const settings = await getPlatformSettings();
    const planId = subscription.plan_id ?? 'trial';
    const plan = settings.plans[planId as keyof typeof settings.plans];
    const callLimit   = plan?.call_limit   ?? 30;
    const minuteLimit = plan?.minute_limit ?? callLimit;

    const callsUsed    = subscription.calls_used    ?? 0;
    const minutesUsed  = subscription.minutes_used  ?? 0;
    const extraCalls   = subscription.extra_calls   ?? 0;
    const extraMinutes = subscription.extra_minutes ?? 0;

    const totalCallsAllowed   = callLimit   === -1 ? -1 : callLimit   + extraCalls;
    const totalMinutesAllowed = minuteLimit === -1 ? -1 : minuteLimit + extraMinutes;

    // Fully unlimited (both calls + minutes) — skip counter update
    if (totalCallsAllowed === -1 && totalMinutesAllowed === -1) {
      return NextResponse.json({ allowed: true, used: callsUsed, limit: -1, remaining: -1, planId, maxCallSeconds: 720 });
    }

    // Minute cap reached → block (calls counter not incremented)
    if (totalMinutesAllowed !== -1 && minutesUsed >= totalMinutesAllowed) {
      return NextResponse.json({
        allowed: false,
        reason: 'limit_reached',
        used: callsUsed,
        limit: totalCallsAllowed,
        remaining: 0,
        minutesUsed,
        minutesLimit: totalMinutesAllowed,
      });
    }

    if (totalCallsAllowed !== -1 && callsUsed >= totalCallsAllowed) {
      return NextResponse.json({
        allowed: false,
        reason: 'limit_reached',
        used: callsUsed,
        limit: totalCallsAllowed,
        remaining: 0,
      });
    }

    // If calls are unlimited but minutes aren't, we can't optimistic-lock by
    // calls_used. Just allow the call — minutes are enforced post-session.
    if (totalCallsAllowed === -1) {
      return NextResponse.json({
        allowed: true,
        used: callsUsed,
        limit: -1,
        remaining: -1,
        planId,
        maxCallSeconds: 720,
        minutesUsed,
        minutesLimit: totalMinutesAllowed,
      });
    }

    const totalAllowed = totalCallsAllowed;

    // ── Atomic increment at call start ──────────────────────────────────────
    // Increment NOW rather than after the call ends. This eliminates the race
    // condition where the next call starts before the previous call's
    // increment-usage write finishes.
    //
    // Guard: only update the row if calls_used hasn't changed since we read it
    // (optimistic lock). If another request incremented it in the meantime and
    // it's now at the limit, this update affects 0 rows → we block the call.
    const { data: updated } = await (db as any)
      .from('subscriptions')
      .update({ calls_used: callsUsed + 1 })
      .eq('id', subscription.id)
      .eq('calls_used', callsUsed)       // optimistic lock
      .lt('calls_used', totalAllowed)    // hard guard: reject if already at limit
      .select('calls_used')
      .maybeSingle();

    if (!updated) {
      // Another concurrent request incremented first and hit the limit
      return NextResponse.json({
        allowed: false,
        reason: 'limit_reached',
        used: totalAllowed,
        limit: totalAllowed,
        remaining: 0,
      });
    }

    // Plan-based call duration caps (seconds)
    const planDurationCaps: Record<string, number> = { trial: 180, starter: 300, pro: 480, business: 720 };
    const maxCallSeconds = planDurationCaps[planId] ?? 300;

    return NextResponse.json({
      allowed: true,
      used: updated.calls_used,
      limit: totalAllowed,
      remaining: Math.max(0, totalAllowed - updated.calls_used),
      planId,
      maxCallSeconds,
      minutesUsed,
      minutesLimit: totalMinutesAllowed,
    });
  } catch (err: any) {
    console.error('[check-limit] error:', err.message);
    // Fail open on unexpected error (prefer availability over strict limiting)
    return NextResponse.json({ allowed: true, used: 0, limit: 0, remaining: 0 });
  }
}
