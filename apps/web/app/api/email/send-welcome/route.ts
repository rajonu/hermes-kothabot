import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';
import { emailTemplates } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const { email, customerName, shopName } = await request.json();

    if (!email || !customerName || !shopName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://kothabot.ai.bd'}/login`;

    const emailTemplate = emailTemplates.welcomeEmail({
      customerName,
      shopName,
      loginUrl,
    });

    await resend.emails.send({
      from: SENDERS.WELCOME,
      to: email,
      bcc: process.env.ADMIN_BCC_EMAIL || undefined,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Welcome email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    );
  }
}
