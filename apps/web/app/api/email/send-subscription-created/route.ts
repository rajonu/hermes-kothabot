import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';
import { emailTemplates } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const { email, customerName, planName, billingCycle, amount, currency } = await request.json();

    if (!email || !customerName || !planName || !billingCycle || !amount || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const emailTemplate = emailTemplates.subscriptionCreated({
      customerName,
      planName,
      billingCycle,
      amount,
      currency,
    });

    await resend.emails.send({
      from: SENDERS.BILLING,
      to: email,
      bcc: process.env.ADMIN_BCC_EMAIL || undefined,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription created email error:', error);
    return NextResponse.json(
      { error: 'Failed to send subscription created email' },
      { status: 500 }
    );
  }
}
