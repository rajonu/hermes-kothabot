import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticketId, message, screenshot } = await req.json();
  if (!ticketId || (!message?.trim() && !screenshot)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Fetch current ticket messages
  const { data: ticket } = await (supabase as any)
    .from('support_tickets')
    .select('messages, shop_id, status')
    .eq('id', ticketId)
    .single();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  if (ticket.status === 'resolved') return NextResponse.json({ error: 'Ticket is resolved' }, { status: 400 });

  const newMessage: any = {
    role: 'client',
    text: message?.trim() ?? '',
    created_at: new Date().toISOString(),
  };
  if (screenshot) newMessage.screenshot = screenshot;

  const updatedMessages = [...(ticket.messages ?? []), newMessage];

  const { error } = await (supabase as any)
    .from('support_tickets')
    .update({
      messages:    updatedMessages,
      status:      'open',
      unread_admin: true,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
