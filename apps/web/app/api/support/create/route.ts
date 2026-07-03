import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';
import { emailTemplates } from '@/lib/email-templates';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { shopId, subject, message, screenshot } = await req.json();
  if (!shopId || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const firstMessage: any = {
    role: 'client',
    text: message.trim(),
    created_at: new Date().toISOString(),
  };
  if (screenshot) firstMessage.screenshot = screenshot;

  const { data, error } = await (supabase as any)
    .from('support_tickets')
    .insert({
      shop_id:     shopId,
      subject:     subject.trim(),
      status:      'open',
      messages:    [firstMessage],
      unread_admin: true,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Fire-and-forget emails: client confirmation + admin notification ──
  sendTicketEmails({
    ticketId:    data.id,
    subject:     subject.trim(),
    message:     message.trim(),
    shopId,
    clientEmail: user.email ?? null,
  }).catch(e => console.warn('[support/create] email failed:', e?.message));

  return NextResponse.json({ id: data.id });
}

async function sendTicketEmails(p: {
  ticketId: string;
  subject: string;
  message: string;
  shopId: string;
  clientEmail: string | null;
}) {
  const db = createAdminClient();
  const { data: shop } = await (db as any)
    .from('shops').select('name').eq('id', p.shopId).single();
  const shopName = shop?.name ?? 'Customer';
  const adminEmail = process.env.ADMIN_BCC_EMAIL || 'rajsyful@gmail.com';
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd';

  // 1. Confirmation to client
  if (p.clientEmail) {
    const tpl = emailTemplates.ticketCreatedConfirmation({
      customerName: shopName,
      ticketId:     p.ticketId,
      subject:      p.subject,
    });
    await resend.emails.send({
      from:    SENDERS.SUPPORT,
      to:      p.clientEmail,
      subject: tpl.subject,
      html:    tpl.html,
    });
  }

  // 2. Notification to admin
  await resend.emails.send({
    from:    SENDERS.SUPPORT,
    to:      adminEmail,
    subject: `🎫 New Support Ticket — ${shopName}: ${p.subject}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#059669;margin:0 0 12px;">New Support Ticket</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Shop</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(shopName)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Client</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(p.clientEmail ?? 'unknown')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Subject</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(p.subject)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Ticket ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${p.ticketId}</td></tr>
        </table>
        <div style="background:#f3f4f6;padding:12px 16px;border-radius:8px;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(p.message).slice(0, 1500)}</div>
        <a href="${dashboardUrl}/admin/support" style="display:inline-block;margin-top:20px;background:#059669;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">Reply in Admin Panel →</a>
      </div>`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
