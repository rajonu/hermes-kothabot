import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendMessage as sendFacebookMessage } from '@/lib/facebook';
import { sendWhatsAppMessage } from '@/lib/bot-server-client';
import { decryptSecret } from '@/lib/crypto';

async function guard(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return { ok: false as const };

  const db = createAdminClient() as any;
  const { data: conversation } = await db
    .from('omni_conversations').select('*').eq('id', id).eq('shop_id', shop.id).single();
  if (!conversation) return { ok: false as const };

  return { ok: true as const, db, shopId: shop.id as string, conversation };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (!g.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await g.db
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Opening a thread is "reading" it — clears its unread dot.
  await g.db.from('omni_conversations').update({ last_read_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (!g.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = body?.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const { conversation, db, shopId } = g;
  let externalMessageId: string | null = null;

  try {
    if (conversation.platform === 'facebook') {
      const { data: channel } = await db
        .from('clients_channels')
        .select('fb_page_id, fb_page_access_token')
        .eq('shop_id', shopId)
        .eq('channel_type', 'facebook')
        .single();
      if (!channel?.fb_page_id || !channel?.fb_page_access_token) {
        return NextResponse.json({ error: 'Facebook channel not configured' }, { status: 400 });
      }
      const pageToken = decryptSecret(channel.fb_page_access_token);
      const sent = await sendFacebookMessage(channel.fb_page_id, pageToken, conversation.customer_external_id, text);
      externalMessageId = sent.message_id;
    } else if (conversation.platform === 'whatsapp') {
      const sent = await sendWhatsAppMessage(shopId, conversation.customer_external_id, text);
      externalMessageId = sent.externalMessageId;
    } else {
      return NextResponse.json({ error: `Unsupported platform: ${conversation.platform}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Send failed' }, { status: 502 });
  }

  // NOTE: deliberately NOT inserting into ai_message_logs — that table is
  // reserved for AI-sent messages only, so the WhatsApp takeover-detector
  // can still tell a later phone-typed message apart from this dashboard reply.
  const { data: inserted, error: insertError } = await db
    .from('conversation_messages')
    .insert({
      conversation_id: id,
      direction: 'out',
      sender: 'human',
      body: text,
      external_message_id: externalMessageId,
    })
    .select('*')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await db.from('omni_conversations').update({
    last_message_at: new Date().toISOString(),
    last_read_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  return NextResponse.json({ message: inserted });
}
