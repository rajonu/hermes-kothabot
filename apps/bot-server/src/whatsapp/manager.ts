import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { Boom } from "@hapi/boom";
import { supabase } from "../supabase";
import { getAuthState, clearAuthState } from "./authState";
import { handleInboundMessage } from "../routing/engine";

const RECONNECT_DELAY_MS = 3000;

// WhatsApp rejects new-device pairing (QR/registration) from datacenter IPs
// but allows already-paired sessions to keep running from anywhere —
// confirmed by reproducing identical "Connection Failure" handshake errors
// on Railway and a separate VPS, while the same code succeeded immediately
// from a residential IP. PROXY_URL routes the socket through a residential
// SOCKS5 proxy (see start.sh / cloudflared sidecar) so pairing works from
// our cloud host. Optional — falls back to a direct connection if unset.
// socks-proxy-agent ships ESM-only; dynamic import avoids forcing this
// whole CommonJS codebase to convert.
let proxyAgentPromise: Promise<any | undefined> | undefined;
function getProxyAgent(): Promise<any | undefined> {
  if (!process.env.PROXY_URL) return Promise.resolve(undefined);
  if (!proxyAgentPromise) {
    proxyAgentPromise = import("socks-proxy-agent").then(
      ({ SocksProxyAgent }) => new SocksProxyAgent(process.env.PROXY_URL!)
    );
  }
  return proxyAgentPromise;
}

/**
 * Tests the residential SOCKS5 proxy chain (this box -> Cloudflare Tunnel ->
 * Raspberry Pi -> home ISP) by fetching a small URL through it. Used by the
 * admin System Health panel to show whether the Pi/proxy leg is up, since a
 * dead proxy silently breaks new WhatsApp pairing without affecting anything
 * already connected.
 */
export async function checkProxyConnectivity(): Promise<{
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  if (!process.env.PROXY_URL) {
    return { configured: false, connected: false, latencyMs: null, error: null };
  }

  const agent = await getProxyAgent();
  const started = Date.now();
  // Node's global fetch (undici) doesn't honor a plain http.Agent via an
  // `agent` option — use the https module directly, which socks-proxy-agent
  // correctly plugs into.
  const https = await import("node:https");
  return new Promise((resolve) => {
    const req = https.request(
      "https://www.google.com/generate_204",
      { agent, timeout: 8000 },
      (res) => {
        res.resume();
        resolve({ configured: true, connected: true, latencyMs: Date.now() - started, error: null });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ configured: true, connected: false, latencyMs: null, error: "timed out" });
    });
    req.on("error", (err) => {
      resolve({ configured: true, connected: false, latencyMs: null, error: err.message });
    });
    req.end();
  });
}

class WhatsAppManager {
  private sockets = new Map<string, WASocket>();

  // ponytail: the takeover detector used to poll ai_message_logs (0/400/900ms
  // retries, ~1.3s total budget) to tell our own AI-sent echo apart from the
  // owner replying from their phone. Confirmed in production: this window is
  // too short — the AI-reply pipeline (Gemini call, possibly with its own
  // 503 retries, then the DB writes in routing.ts) regularly takes longer
  // than 1.3s end to end, so the echo arrives before ai_message_logs is
  // written and the detector false-positives, pausing the AI on its own
  // reply. Track our own sent message ids in memory instead — populated
  // synchronously in sendMessage() before the echo can possibly arrive, no
  // DB round-trip, no race.
  private ownMessageIds = new Set<string>();
  private ownMessageIdOrder: string[] = [];
  private static readonly MAX_OWN_MESSAGE_IDS = 500;

  private rememberOwnMessageId(id: string): void {
    this.ownMessageIds.add(id);
    this.ownMessageIdOrder.push(id);
    if (this.ownMessageIdOrder.length > WhatsAppManager.MAX_OWN_MESSAGE_IDS) {
      const oldest = this.ownMessageIdOrder.shift();
      if (oldest) this.ownMessageIds.delete(oldest);
    }
  }

  // ponytail: Baileys fires `messages.upsert` as a separate event per
  // inbound message (not batched), and the listener is async with no
  // queueing — a customer sending "hello" then "Hi" a few seconds later
  // (well within AI-reply latency, especially with retries) triggers two
  // concurrent handleInboundMessage() calls. Each reads conversation
  // history before the other's AI reply is saved, so both call Gemini with
  // a stale/incomplete view and each replies with a generic greeting
  // instead of building on the conversation. Chain each conversation's
  // processing through a promise queue so it's always strictly sequential,
  // even across separate Baileys events — the next message only starts
  // once the previous one's DB writes (including the AI reply) are done.
  private conversationQueues = new Map<string, Promise<void>>();

  private enqueueConversation(key: string, task: () => Promise<void>): Promise<void> {
    const prior = this.conversationQueues.get(key) ?? Promise.resolve();
    const next = prior.then(task, task).finally(() => {
      if (this.conversationQueues.get(key) === next) this.conversationQueues.delete(key);
    });
    this.conversationQueues.set(key, next);
    return next;
  }

  getSocket(shopId: string): WASocket | undefined {
    return this.sockets.get(shopId);
  }

  async initSession(shopId: string): Promise<void> {
    const { state, saveCreds } = await getAuthState(shopId);
    const proxyAgent = await getProxyAgent();

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      agent: proxyAgent,
      fetchAgent: proxyAgent,
    });

    this.sockets.set(shopId, sock);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr);
          await supabase.channel(`shop:${shopId}`).send({
            type: "broadcast",
            event: "wa_qr",
            payload: { qr: dataUrl },
          });
        } catch (err: any) {
          console.error(`[whatsapp] failed to render/broadcast QR for shop ${shopId}:`, err.message);
        }
      }

      if (connection === "open") {
        await saveCreds();
        await supabase
          .from("clients_channels")
          .update({
            is_active: true,
            connected_at: new Date().toISOString(),
            wa_phone: sock.user?.id ?? null,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("shop_id", shopId)
          .eq("channel_type", "whatsapp");

        await supabase.channel(`shop:${shopId}`).send({
          type: "broadcast",
          event: "wa_connected",
          payload: { phone: sock.user?.id ?? null },
        });

        console.log(`[whatsapp] shop ${shopId} connected (${sock.user?.id ?? "unknown"})`);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.sockets.delete(shopId);

        if (!loggedOut) {
          console.warn(`[whatsapp] shop ${shopId} disconnected, reconnecting in ${RECONNECT_DELAY_MS}ms`);
          setTimeout(() => {
            this.initSession(shopId).catch((err) =>
              console.error(`[whatsapp] reconnect failed for shop ${shopId}:`, err.message)
            );
          }, RECONNECT_DELAY_MS);
        } else {
          console.warn(`[whatsapp] shop ${shopId} logged out — clearing session`);
          await clearAuthState(shopId);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        try {
          if (msg.key.fromMe) {
            await this.handleOwnMessage(shopId, msg);
          } else {
            const jid = msg.key.remoteJid;
            const messageId = msg.key.id;
            const text =
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              "";

            const audioMsg = msg.message?.audioMessage;
            let audio: { base64: string; mimeType: string } | undefined;
            if (audioMsg) {
              try {
                const buf = (await downloadMediaMessage(msg, "buffer", {})) as Buffer;
                // WhatsApp voice notes are OGG/Opus — Gemini accepts audio/ogg
                // directly, no separate transcription step needed.
                audio = { base64: buf.toString("base64"), mimeType: audioMsg.mimetype || "audio/ogg" };
              } catch (err: any) {
                console.error(`[whatsapp] failed to download voice note (shop ${shopId}):`, err.message);
              }
            }

            if (!jid || (!text && !audio)) continue;

            await this.enqueueConversation(`${shopId}:${jid}`, () =>
              handleInboundMessage({
                shopId,
                jid,
                customerName: msg.pushName ?? undefined,
                text,
                externalMessageId: messageId ?? undefined,
                audio,
              })
            );
          }
        } catch (err: any) {
          console.error(`[whatsapp] error handling message for shop ${shopId}:`, err.message);
        }
      }
    });
  }

  /**
   * Takeover detector: a `fromMe` message is either (a) one our own AI sent
   * via sendMessage() — its id is in ownMessageIds — or (b) the shop owner
   * typing from their own linked phone. In case (b), pause the AI for that
   * conversation and notify the dashboard.
   */
  private async handleOwnMessage(shopId: string, msg: any): Promise<void> {
    const messageId = msg.key.id as string | undefined;
    const jid = msg.key.remoteJid as string | undefined;
    if (!messageId || !jid) return;

    if (this.ownMessageIds.has(messageId)) {
      // This is our own AI-sent message echoed back — ignore.
      return;
    }

    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    const { data: conversation, error: convError } = await supabase
      .from("omni_conversations")
      .upsert(
        {
          shop_id: shopId,
          platform: "whatsapp",
          customer_external_id: jid,
          is_ai_paused: true,
          paused_at: new Date().toISOString(),
          pause_reason: "phone",
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_id,platform,customer_external_id" }
      )
      .select("id")
      .single();

    if (convError || !conversation) {
      console.error(`[whatsapp] failed to upsert conversation for takeover (shop ${shopId}):`, convError?.message);
      return;
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: conversation.id,
      direction: "out",
      sender: "human",
      body: text,
      external_message_id: messageId,
    });

    await supabase.channel(`shop:${shopId}`).send({
      type: "broadcast",
      event: "ai_paused_by_phone",
      payload: { jid },
    });

    console.log(`[whatsapp] shop ${shopId} AI paused — owner replied from phone to ${jid}`);
  }

  async sendMessage(shopId: string, jid: string, text: string): Promise<{ externalMessageId: string }> {
    const sock = this.sockets.get(shopId);
    if (!sock) {
      const err: any = new Error(`No active WhatsApp socket for shop ${shopId}`);
      err.code = "NO_ACTIVE_SOCKET";
      throw err;
    }

    const result = await sock.sendMessage(jid, { text });
    const externalMessageId = result?.key?.id;
    if (!externalMessageId) {
      throw new Error("WhatsApp send did not return a message id");
    }

    this.rememberOwnMessageId(externalMessageId);
    return { externalMessageId };
  }

  /**
   * Logs out and removes the in-memory socket for a shop, if one exists.
   * Used when the dashboard owner explicitly disconnects WhatsApp.
   * Idempotent — does nothing if there's no live socket.
   */
  async disconnect(shopId: string): Promise<void> {
    const sock = this.sockets.get(shopId);
    if (sock) {
      this.sockets.delete(shopId);
      try {
        await sock.logout();
      } catch (err: any) {
        console.error(`[whatsapp] logout failed for shop ${shopId}:`, err?.message);
      }
    }

    // Always clear persisted auth, even with no live socket (e.g. it died
    // mid-reconnect-loop before this call) — otherwise stale creds get
    // reused on the next Link Device attempt and the handshake never
    // produces a QR.
    await clearAuthState(shopId);
  }
}

export const whatsAppManager = new WhatsAppManager();
