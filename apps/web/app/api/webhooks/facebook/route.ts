/**
 * Facebook Messenger webhook — verification (GET) + inbound events (POST).
 * Always returns 200 quickly to Meta; processing happens inline given
 * expected volume, errors are caught and logged rather than surfaced.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { handleInboundMessage } from '@/lib/routing';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  processEntries(payload).catch((err) => console.error('[webhooks/facebook] processing error:', err?.message));

  return NextResponse.json({ ok: true });
}

async function processEntries(payload: any): Promise<void> {
  const db = createAdminClient() as any;
  const entries = payload?.entry ?? [];

  for (const entry of entries) {
    const pageId = entry.id;
    const messagingEvents = entry.messaging ?? [];

    for (const event of messagingEvents) {
      const text = event.message?.text;
      const messageId = event.message?.mid;
      const senderPsid = event.sender?.id;

      // Skip echoes, postbacks, delivery/read receipts, and anything without text.
      if (!text || !senderPsid || event.message?.is_echo) continue;

      try {
        const { data: channel } = await db
          .from('clients_channels')
          .select('shop_id')
          .eq('fb_page_id', pageId)
          .eq('channel_type', 'facebook')
          .eq('is_active', true)
          .maybeSingle();

        if (!channel?.shop_id) {
          console.warn(`[webhooks/facebook] no shop found for page ${pageId}`);
          continue;
        }

        await handleInboundMessage({
          shopId: channel.shop_id,
          platform: 'facebook',
          externalId: senderPsid,
          customerName: null,
          text,
          externalMessageId: messageId ?? null,
        });
      } catch (err: any) {
        console.error('[webhooks/facebook] event handling error:', err?.message);
      }
    }
  }
}
