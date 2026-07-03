import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';
import { getPlatformSettings } from '@/lib/platform-settings';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { requestId, decision, note, shopId, planId } = await req.json();
  if (!requestId || !decision || !shopId || !planId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Update payment request status
  const { error: updateErr } = await (db as any)
    .from('payment_requests')
    .update({ status: decision, admin_note: note || null })
    .eq('id', requestId);

  if (updateErr) {
    console.error('[review-payment] update error:', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 2. If approved → activate subscription immediately
  if (decision === 'approved') {
    const settings = await getPlatformSettings();
    const plan = settings.plans[planId as keyof typeof settings.plans];
    if (!plan) return NextResponse.json({ error: 'Unknown plan: ' + planId }, { status: 400 });

    // Use payment request date as the billing start date
    const { data: paymentReq } = await (db as any)
      .from('payment_requests')
      .select('created_at')
      .eq('id', requestId)
      .single();

    const startDate  = paymentReq?.created_at ? new Date(paymentReq.created_at) : new Date();
    const periodEnd  = new Date(startDate);
    periodEnd.setDate(periodEnd.getDate() + plan.period_days);

    // Check if subscription already exists
    const { data: existingSub } = await (db as any)
      .from('subscriptions')
      .select('id')
      .eq('shop_id', shopId)
      .single();

    let subError;

    if (existingSub) {
      // UPDATE existing subscription
      const { error } = await (db as any)
        .from('subscriptions')
        .update({
          plan_id:            planId,
          plan:               'monthly',    // keep enum valid
          status:             'active',
          current_period_end: periodEnd.toISOString(),
          payment_provider:   'manual',
        })
        .eq('shop_id', shopId);
      subError = error;
    } else {
      // INSERT new subscription
      const { error } = await (db as any)
        .from('subscriptions')
        .insert({
          shop_id:            shopId,
          plan_id:            planId,
          plan:               'monthly',    // keep enum valid
          status:             'active',
          current_period_end: periodEnd.toISOString(),
          payment_method:     'bkash',
          payment_provider:   'manual',
        });
      subError = error;
    }

    if (subError) {
      console.error('[review-payment] subscription error:', JSON.stringify(subError));
      return NextResponse.json({ error: 'Payment approved but subscription update failed: ' + subError.message }, { status: 500 });
    }
  }

  // ── Fire-and-forget: email client about the decision ──
  notifyClientOfDecision(db, shopId, planId, decision, note).catch(
    e => console.warn('[review-payment] email failed:', e?.message)
  );

  return NextResponse.json({ success: true });
}

async function notifyClientOfDecision(
  db: any, shopId: string, planId: string, decision: string, note?: string
) {
  // Resolve client email via shop owner
  const { data: shop } = await db.from('shops').select('name, owner_id').eq('id', shopId).single();
  if (!shop?.owner_id) return;
  const { data: userRes } = await db.auth.admin.getUserById(shop.owner_id);
  const email = userRes?.user?.email;
  if (!email) return;

  const approved = decision === 'approved';
  await resend.emails.send({
    from: SENDERS.BILLING,
    to: email,
    subject: approved
      ? `✅ Your KothaBot subscription is active — ${shop.name}`
      : `Payment update for ${shop.name}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:${approved ? '#059669' : '#dc2626'};margin:0 0 12px;">
          ${approved ? 'Subscription Activated 🎉' : 'Payment Not Approved'}
        </h2>
        <p style="color:#374151;font-size:14px;line-height:1.6;">
          ${approved
            ? `Your payment for the <strong>${planId}</strong> plan has been verified and your subscription is now active. Thank you for choosing KothaBot!`
            : `Unfortunately we could not verify your payment for the <strong>${planId}</strong> plan.`}
        </p>
        ${note ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:13px;color:#374151;"><strong>Note:</strong> ${note}</p>` : ''}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd'}/billing" style="display:inline-block;margin-top:16px;background:#059669;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">Go to Dashboard →</a>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px;">KothaBot — AI Voice Assistant for Bangladeshi Businesses</p>
      </div>`,
  });
}
