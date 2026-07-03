import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';
import { sendPushNotification } from '@/lib/push';
import resend from '@/lib/resend';
import { SENDERS } from '@/lib/email-senders';
import { emailTemplates } from '@/lib/email-templates';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { ticketId, message, screenshot, customerEmail, customerName, shopName, subject } = await req.json();
  if (!ticketId || (!message?.trim() && !screenshot)) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = createAdminClient();
  const { data: ticket } = await (db as any)
    .from('support_tickets').select('messages, shop_id').eq('id', ticketId).single();
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newMsg: any = { role: 'admin', text: message?.trim() ?? '', created_at: new Date().toISOString() };
  if (screenshot) newMsg.screenshot = screenshot;
  const { error } = await (db as any)
    .from('support_tickets')
    .update({
      messages:     [...(ticket.messages ?? []), newMsg],
      status:       'pending',
      unread_client: true,
      unread_admin:  false,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push notification to client
  if (ticket.shop_id) {
    sendPushNotification({
      shopId: ticket.shop_id,
      title:  'KothaBot Support',
      body:   'You have a new reply to your support ticket',
      url:    '/support',
      tag:    `support-${ticketId}`,
    }).catch(() => {});
  }

  // ── Resolve customer email server-side (don't trust client placeholders) ──
  notifyClient(db, ticketId, message?.trim() ?? '', subject, shopName)
    .catch(e => console.warn('[support/reply] email failed:', e?.message));

  return NextResponse.json({ success: true });
}

async function notifyClient(
  db: any, ticketId: string, replyText: string, subjectOverride?: string, shopNameOverride?: string
) {
  // Get the ticket → shop → owner email
  const { data: t } = await db
    .from('support_tickets')
    .select('subject, shop_id, shops(name, owner_id)')
    .eq('id', ticketId)
    .single();
  if (!t?.shops?.owner_id) return;

  const { data: userRes } = await db.auth.admin.getUserById(t.shops.owner_id);
  const email = userRes?.user?.email;
  if (!email) return;

  const tpl = emailTemplates.supportTicketReply({
    ticketId,
    customerName: shopNameOverride || t.shops.name || 'Valued Customer',
    replyMessage: replyText,
    subject:      subjectOverride || t.subject || 'Support Reply',
    shopName:     shopNameOverride || t.shops.name || 'KothaBot Support',
  });

  await resend.emails.send({
    from:    SENDERS.SUPPORT,
    to:      email,
    subject: tpl.subject,
    html:    tpl.html,
  });
}
