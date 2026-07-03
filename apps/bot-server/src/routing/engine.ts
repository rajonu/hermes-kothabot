import { supabase } from "../supabase";
import { whatsAppManager } from "../whatsapp/manager";

const WEB_URL = process.env.WEB_URL;
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;

const AUTO_RESUME_MS = 30 * 60 * 1000; // 30 minutes
const HISTORY_LIMIT = 20;

interface InboundMessageInput {
  shopId: string;
  jid: string;
  customerName?: string;
  text: string;
  externalMessageId?: string;
  /** Voice note audio, sent instead of/alongside text — Gemini reads it directly. */
  audio?: { base64: string; mimeType: string };
}

/**
 * WhatsApp-side mirror of the web app's inbound routing (apps/web/lib/routing.ts
 * handles the Facebook side with the same steps). Keep behavior consistent
 * between the two.
 */
export async function handleInboundMessage(input: InboundMessageInput): Promise<void> {
  const { shopId, jid, customerName, text, externalMessageId, audio } = input;

  // a. Upsert conversation
  const { data: conversation, error: convError } = await supabase
    .from("omni_conversations")
    .upsert(
      {
        shop_id: shopId,
        platform: "whatsapp",
        customer_external_id: jid,
        ...(customerName ? { customer_name: customerName } : {}),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,platform,customer_external_id" }
    )
    .select("id, is_ai_paused, paused_at")
    .single();

  if (convError || !conversation) {
    console.error(`[routing] failed to upsert conversation (shop ${shopId}, jid ${jid}):`, convError?.message);
    return;
  }

  // b. Log inbound message. Voice notes have no text body — store a
  // placeholder so the dashboard/history view shows something readable.
  await supabase.from("conversation_messages").insert({
    conversation_id: conversation.id,
    direction: "in",
    sender: "customer",
    body: text || (audio ? "🎤 Voice note" : ""),
    external_message_id: externalMessageId,
  });

  // c. Auto-resume if paused for more than 30 minutes
  let isPaused = conversation.is_ai_paused;
  if (isPaused && conversation.paused_at) {
    const pausedAt = new Date(conversation.paused_at).getTime();
    if (Date.now() - pausedAt > AUTO_RESUME_MS) {
      await supabase
        .from("omni_conversations")
        .update({ is_ai_paused: false, paused_at: null, pause_reason: null, updated_at: new Date().toISOString() })
        .eq("id", conversation.id);
      isPaused = false;
    }
  }

  // d. Still paused — stop, don't call AI.
  if (isPaused) {
    return;
  }

  // e. Load recent history, call web's internal AI endpoint.
  const { data: historyRows, error: historyError } = await supabase
    .from("conversation_messages")
    .select("sender, body, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    console.error(`[routing] failed to load history (conversation ${conversation.id}):`, historyError.message);
    return;
  }

  const history = (historyRows ?? [])
    .reverse()
    .map((row) => ({
      role: row.sender === "customer" ? ("user" as const) : ("model" as const),
      text: row.body ?? "",
    }));

  if (!WEB_URL || !BOT_INTERNAL_SECRET) {
    console.error("[routing] WEB_URL / BOT_INTERNAL_SECRET not configured — cannot call AI endpoint");
    return;
  }

  let reply: string;
  try {
    const res = await fetch(`${WEB_URL}/api/internal/ai-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": BOT_INTERNAL_SECRET,
      },
      body: JSON.stringify({ shopId, history, message: text, audio }),
    });

    if (!res.ok) {
      console.error(`[routing] ai-reply endpoint returned ${res.status}`);
      return;
    }

    const json = (await res.json()) as { reply?: string };
    if (!json.reply) {
      console.error("[routing] ai-reply endpoint returned no reply");
      return;
    }
    reply = json.reply;
  } catch (err: any) {
    console.error("[routing] failed to call ai-reply endpoint:", err.message);
    return;
  }

  // f. Send the reply via WhatsApp
  let sendResult: { externalMessageId: string };
  try {
    sendResult = await whatsAppManager.sendMessage(shopId, jid, reply);
  } catch (err: any) {
    console.error(`[routing] failed to send AI reply (shop ${shopId}, jid ${jid}):`, err.message);
    return;
  }

  // g. Log ai_message_logs FIRST — Baileys echoes our own sent message back
  // over the same socket as a `fromMe` event almost immediately, and the
  // takeover detector (handleOwnMessage) checks this table to tell our own
  // echo apart from the owner replying from their phone. If this insert
  // lands after the echo arrives, the detector wrongly treats it as a
  // takeover and pauses the AI on its own reply.
  await supabase.from("ai_message_logs").insert({
    conversation_id: conversation.id,
    message_external_id: sendResult.externalMessageId,
  });

  await supabase.from("conversation_messages").insert({
    conversation_id: conversation.id,
    direction: "out",
    sender: "ai",
    body: reply,
    external_message_id: sendResult.externalMessageId,
  });
}
