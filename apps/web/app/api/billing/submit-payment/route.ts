import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlatformSettings } from '@/lib/platform-settings';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { shopId, planId, amount, method, phone_last4, transaction_id } = await req.json();

  if (!shopId || !planId || !amount || !method || !phone_last4 || !transaction_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(phone_last4)) {
    return NextResponse.json({ error: 'phone_last4 must be exactly 4 digits' }, { status: 400 });
  }
  if (transaction_id.trim().length < 4) {
    return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 });
  }

  // Verify shop belongs to this user
  const db = createAdminClient();
  const { data: shop } = await (db as any).from('shops').select('id,name').eq('id', shopId).eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Check for duplicate pending request for same plan
  const { data: existing } = await (db as any)
    .from('payment_requests')
    .select('id')
    .eq('shop_id', shopId)
    .eq('plan_id', planId)
    .eq('status', 'pending')
    .single();

  if (existing) {
    return NextResponse.json({ error: 'A pending payment request for this plan already exists. Please wait for approval.' }, { status: 409 });
  }

  // Insert payment request
  const { error } = await (db as any).from('payment_requests').insert({
    shop_id:        shopId,
    plan_id:        planId,
    amount,
    method,
    phone_last4,
    transaction_id: transaction_id.trim().toUpperCase(),
    status:         'pending',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Fire-and-forget email notifications (never block the response) ──
  sendPaymentEmails({
    clientEmail: user.email ?? null,
    shopName: shop.name,
    planId,
    amount,
    method,
    transactionId: transaction_id.trim().toUpperCase(),
  }).catch(e => console.warn('[submit-payment] email failed:', e?.message));

  return NextResponse.json({ success: true });
}

async function sendPaymentEmails(p: {
  clientEmail: string | null;
  shopName: string;
  planId: string;
  amount: number;
  method: string;
  transactionId: string;
}) {
  const adminEmail = process.env.ADMIN_BCC_EMAIL || 'rajsyful@gmail.com';
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd';

  // 1. Notify admin of a new payment to review
  await resend.emails.send({
    from: SENDERS.BILLING,
    to: adminEmail,
    subject: `💳 New Payment Submitted — ${p.shopName} (${p.planId})`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#059669;margin:0 0 16px;">New Payment Awaiting Review</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6b7280;">Shop</td><td style="padding:6px 0;font-weight:600;">${p.shopName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Plan</td><td style="padding:6px 0;font-weight:600;">${p.planId}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Amount</td><td style="padding:6px 0;font-weight:600;">৳${p.amount}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Method</td><td style="padding:6px 0;font-weight:600;">${p.method}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Transaction ID</td><td style="padding:6px 0;font-weight:600;">${p.transactionId}</td></tr>
        </table>
        <a href="${dashboardUrl}/admin" style="display:inline-block;margin-top:20px;background:#059669;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">Review in Admin Panel →</a>
      </div>`,
  });

  // 2. Confirm receipt to the client
  if (p.clientEmail) {
    await resend.emails.send({
      from: SENDERS.BILLING,
      to: p.clientEmail,
      subject: `We received your payment — ${p.shopName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#059669;margin:0 0 12px;">Payment Received ✅</h2>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Thank you! We've received your payment submission for the <strong>${p.planId}</strong> plan.
            Our team will verify it shortly and activate your subscription — usually within a few hours.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
            <tr><td style="padding:6px 0;color:#6b7280;">Amount</td><td style="padding:6px 0;font-weight:600;">৳${p.amount}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Method</td><td style="padding:6px 0;font-weight:600;">${p.method}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Transaction ID</td><td style="padding:6px 0;font-weight:600;">${p.transactionId}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;font-weight:600;color:#d97706;">Pending Review</td></tr>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">KothaBot — AI Voice Assistant for Bangladeshi Businesses</p>
        </div>`,
    });
  }
}
