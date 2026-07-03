import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';
import { emailTemplates } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const {
      ticketId,
      customerEmail,
      customerName,
      shopName,
      replyMessage,
      subject,
    } = await request.json();

    if (!ticketId || !customerEmail || !replyMessage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const emailTemplate = emailTemplates.supportTicketReply({
      ticketId,
      customerName: customerName || 'Valued Customer',
      replyMessage,
      subject,
      shopName: shopName || 'Support Team',
    });

    await resend.emails.send({
      from: SENDERS.SUPPORT,
      to: customerEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
