import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSession();
  if (adminCheck) return adminCheck;

  try {
    const { subscriptionId, field, amount } = await req.json();

    if (!subscriptionId || !field || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['extra_calls', 'extra_minutes'].includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: subscription, error: fetchError } = await (db as any)
      .from('subscriptions')
      .select('id, extra_calls, extra_minutes')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const currentValue = subscription[field] ?? 0;
    const newValue = Math.max(0, currentValue + amount);

    const { data: updated, error: updateError } = await (db as any)
      .from('subscriptions')
      .update({ [field]: newValue })
      .eq('id', subscriptionId)
      .select('extra_calls, extra_minutes')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      extra_calls:   updated.extra_calls,
      extra_minutes: updated.extra_minutes,
    });
  } catch (err: any) {
    console.error('[admin/usage/adjust] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
