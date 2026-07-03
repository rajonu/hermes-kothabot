import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';

export async function POST(request: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  try {
    const { email, subject, html } = await request.json();

    if (!email || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: email, subject, html' },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: SENDERS.TEST,
      to: email,
      bcc: process.env.ADMIN_BCC_EMAIL || undefined,
      subject: `[TEST] ${subject}`,
      html: html,
    });

    return NextResponse.json({ success: true, message: 'Test email sent' });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}
