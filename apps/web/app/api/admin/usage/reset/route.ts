import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSession();
  if (adminCheck) return adminCheck;

  try {
    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });
    }

    const db = createAdminClient();

    const { error: updateError } = await (db as any)
      .from('subscriptions')
      .update({
        calls_used:    0,
        minutes_used:  0,
        last_reset_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[admin/usage/reset] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
