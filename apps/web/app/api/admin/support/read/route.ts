import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { ticketId } = await req.json();
  if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });

  const db = createAdminClient();
  await (db as any).from('support_tickets').update({ unread_admin: false }).eq('id', ticketId);
  return NextResponse.json({ success: true });
}
