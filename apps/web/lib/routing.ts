/**
 * Shared inbound-message routing engine for omnichannel (Facebook Messenger +
 * WhatsApp via apps/bot-server). One conversation pipeline: persist inbound
 * message, respect human takeover (is_ai_paused), run the AI, send the reply
 * on the right channel, persist outbound message, log it for the WhatsApp
 * takeover-detector, and best-effort order/appointment extraction.
 */
import { createAdminClient } from '@/lib/supabase/server';
import { runAIReply } from '@/lib/ai-inference';
import { extractAndSaveOrder, isConfirmed, type ShopCategory } from '@/lib/order-extraction';
import { sendMessage as sendFacebookMessage } from '@/lib/facebook';
import { sendWhatsAppMessage } from '@/lib/bot-server-client';
import { decryptSecret } from '@/lib/crypto';

export type ChannelPlatform = 'facebook' | 'whatsapp';

export interface HandleInboundMessageArgs {
  shopId: string;
  platform: ChannelPlatform;
  externalId: string;
  customerName?: string | null;
  text: string;
  externalMessageId?: string | null;
}

// Auto-resume window — if a human paused the AI (took over via dashboard or
// phone) but went quiet for 30 min, hand control back to the AI rather than
// leaving the customer stuck with no responder.
const AUTO_RESUME_MS = 30 * 60 * 1000;

// Most recent messages fed back into the AI as conversation history.
const HISTORY_LIMIT = 20;

// ponytail: each webhook POST (Facebook) processes independently — a
// customer sending two messages a few seconds apart (well within AI-reply
// latency) triggers two concurrent calls that each read conversation
// history before the other's AI reply is saved, so both call the AI with a
// stale view and both reply with a generic greeting instead of building on
// the conversation. This process is long-running (systemd, not
// serverless), so a module-level queue keyed per conversation actually
// works — chain each conversation's processing so it's always sequential.
const conversationQueues = new Map<string, Promise<void>>();

function enqueueConversation(key: string, task: () => Promise<void>): Promise<void> {
  const prior = conversationQueues.get(key) ?? Promise.resolve();
  const next = prior.then(task, task).finally(() => {
    if (conversationQueues.get(key) === next) conversationQueues.delete(key);
  });
  conversationQueues.set(key, next);
  return next;
}

export function handleInboundMessage(args: HandleInboundMessageArgs): Promise<void> {
  return enqueueConversation(`${args.shopId}:${args.platform}:${args.externalId}`, () => handleInboundMessageInner(args));
}

async function handleInboundMessageInner({
  shopId,
  platform,
  externalId,
  customerName,
  text,
  externalMessageId,
}: HandleInboundMessageArgs): Promise<void> {
  const db = createAdminClient() as any;

  // (a) Upsert conversation
  const { data: existingConv } = await db
    .from('omni_conversations')
    .select('*')
    .eq('shop_id', shopId)
    .eq('platform', platform)
    .eq('customer_external_id', externalId)
    .maybeSingle();

  let conversation = existingConv;
  const nowIso = new Date().toISOString();

  if (!conversation) {
    const { data: created } = await db.from('omni_conversations').insert({
      shop_id: shopId,
      platform,
      customer_external_id: externalId,
      customer_name: customerName ?? null,
      last_message_at: nowIso,
    }).select('*').single();
    conversation = created;
  } else {
    const patch: any = { last_message_at: nowIso, updated_at: nowIso };
    if (customerName) patch.customer_name = customerName;
    await db.from('omni_conversations').update(patch).eq('id', conversation.id);
    conversation = { ...conversation, ...patch };
  }

  if (!conversation) {
    console.error(`[routing] failed to upsert conversation for shop ${shopId}`);
    return;
  }

  // (b) Persist inbound message
  await db.from('conversation_messages').insert({
    conversation_id: conversation.id,
    direction: 'in',
    sender: 'customer',
    body: text,
    external_message_id: externalMessageId ?? null,
  });

  // (c) Auto-resume check
  if (conversation.is_ai_paused && conversation.paused_at) {
    const pausedAtMs = new Date(conversation.paused_at).getTime();
    if (Date.now() - pausedAtMs > AUTO_RESUME_MS) {
      await db.from('omni_conversations').update({
        is_ai_paused: false,
        paused_at: null,
        pause_reason: null,
      }).eq('id', conversation.id);
      conversation.is_ai_paused = false;
    }
  }

  // (d) Human is handling it — stop here, message already visible via Realtime.
  if (conversation.is_ai_paused) return;

  // (e) Build history + run AI
  const { data: shop } = await db.from('shops').select('*').eq('id', shopId).single();
  if (!shop) {
    console.error(`[routing] shop ${shopId} not found`);
    return;
  }

  const { data: recentMessages } = await db
    .from('conversation_messages')
    .select('sender, body')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  // sender='human' is treated as 'model' too — from the AI's point of view a
  // human agent's reply is still "what was said to the customer" and belongs
  // in the assistant turn so the AI doesn't repeat it.
  const history = (recentMessages ?? [])
    .reverse()
    .filter((m: any) => m.sender !== 'customer' || m.body)
    .map((m: any) => ({
      role: m.sender === 'customer' ? ('user' as const) : ('model' as const),
      text: m.body ?? '',
    }));

  let reply: string;
  try {
    reply = await runAIReply({ shop, history, message: text });
  } catch (err: any) {
    console.error(`[routing] runAIReply failed for shop ${shopId}:`, err?.message);
    return;
  }

  // (f) Send reply on the right channel
  let sentExternalId: string | null = null;
  try {
    if (platform === 'facebook') {
      const { data: channel } = await db
        .from('clients_channels')
        .select('fb_page_id, fb_page_access_token')
        .eq('shop_id', shopId)
        .eq('channel_type', 'facebook')
        .single();
      if (!channel?.fb_page_id || !channel?.fb_page_access_token) {
        console.error(`[routing] no facebook channel configured for shop ${shopId}`);
        return;
      }
      const pageToken = decryptSecret(channel.fb_page_access_token);
      const sent = await sendFacebookMessage(channel.fb_page_id, pageToken, externalId, reply);
      sentExternalId = sent.message_id;
    } else if (platform === 'whatsapp') {
      const sent = await sendWhatsAppMessage(shopId, externalId, reply);
      sentExternalId = sent.externalMessageId;
    }
  } catch (err: any) {
    console.error(`[routing] send failed for shop ${shopId} on ${platform}:`, err?.message);
    return;
  }

  // (g) Persist outbound message + AI message log
  await db.from('conversation_messages').insert({
    conversation_id: conversation.id,
    direction: 'out',
    sender: 'ai',
    body: reply,
    external_message_id: sentExternalId,
  });

  // ai_message_logs lets the WhatsApp takeover-detector recognize this as an
  // AI-sent message later (vs. a message a human sent manually from their phone).
  if (sentExternalId) {
    await db.from('ai_message_logs').insert({
      conversation_id: conversation.id,
      message_external_id: sentExternalId,
    }).then(() => {}, (err: any) => console.warn('[routing] ai_message_logs insert failed:', err?.message));
  }

  // (h) Best-effort order/appointment extraction — reuses the exact same
  // logic widget-chat uses (lib/order-extraction.ts), so orders placed over
  // Messenger/WhatsApp fire the same webhooks/push notifications.
  if (isConfirmed(reply)) {
    const category: ShopCategory = (shop.category ?? 'other') as ShopCategory;
    const fullHistory = [...history, { role: 'user', text }, { role: 'assistant', text: reply }];
    extractAndSaveOrder(shopId, category, fullHistory, db, platform).catch((err: any) =>
      console.error(`[routing] extractAndSaveOrder failed for shop ${shopId}:`, err?.message)
    );
  }
}
