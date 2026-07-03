import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { ticketId } = await req.json();
  if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await (db as any)
    .from('support_tickets')
    .update({ status: 'resolved', unread_client: true, updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
