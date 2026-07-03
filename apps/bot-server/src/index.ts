import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import pino from "pino";
import { supabase } from "./supabase";
import { whatsAppManager, checkProxyConnectivity } from "./whatsapp/manager";

const logger = pino({ name: "bot-server" });

const PORT = parseInt(process.env.PORT ?? "8081");
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;

if (!BOT_INTERNAL_SECRET) {
  logger.error("BOT_INTERNAL_SECRET is required");
  process.exit(1);
}

const app = express();
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

// ── Internal: proxy/Pi connectivity, for the admin System Health panel ──────
app.get("/internal/proxy-status", requireInternalSecret, async (_req: Request, res: Response) => {
  const status = await checkProxyConnectivity();
  res.status(200).json(status);
});

// ── Internal: send a WhatsApp message (called by the web app) ───────────────
function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-internal-secret");
  if (provided !== BOT_INTERNAL_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

app.post("/internal/wa-send", requireInternalSecret, async (req: Request, res: Response) => {
  const { shopId, jid, text } = req.body ?? {};

  if (!shopId || !jid || !text) {
    res.status(400).json({ error: "shopId, jid, and text are required" });
    return;
  }

  try {
    const { externalMessageId } = await whatsAppManager.sendMessage(shopId, jid, text);
    res.status(200).json({ ok: true, externalMessageId });
  } catch (err: any) {
    if (err.code === "NO_ACTIVE_SOCKET") {
      res.status(409).json({ error: err.message });
      return;
    }
    logger.error({ err }, "failed to send WhatsApp message");
    res.status(500).json({ error: err.message ?? "failed to send message" });
  }
});

// ── Internal: start (or resume) pairing a shop's WhatsApp session ──────────
// Idempotent — initSession() is safe to call again; if a socket already
// exists for this shop, Baileys/manager will just keep using it. QR codes
// and the "connected" event are pushed via Realtime broadcast on
// `shop:{shopId}` (events `wa_qr` / `wa_connected`), not returned here.
app.post("/internal/wa-init", requireInternalSecret, async (req: Request, res: Response) => {
  const { shopId } = req.body ?? {};

  if (!shopId) {
    res.status(400).json({ error: "shopId is required" });
    return;
  }

  // Fire-and-forget — pairing can take a while (QR scan), don't block the response.
  whatsAppManager.initSession(shopId).catch((err) => {
    logger.error({ err, shopId }, "failed to init WhatsApp session");
  });

  res.status(200).json({ ok: true });
});

// ── Internal: disconnect a shop's WhatsApp session ──────────────────────────
app.post("/internal/wa-disconnect", requireInternalSecret, async (req: Request, res: Response) => {
  const { shopId } = req.body ?? {};

  if (!shopId) {
    res.status(400).json({ error: "shopId is required" });
    return;
  }

  try {
    await whatsAppManager.disconnect(shopId);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    logger.error({ err, shopId }, "failed to disconnect WhatsApp session");
    res.status(500).json({ error: err.message ?? "failed to disconnect" });
  }
});

// ── Boot: restore active sessions for all shops with WhatsApp connected ─────
// ponytail: this used to run exactly once at boot with no retry — a single
// transient DB timeout (observed in production) left every shop's WhatsApp
// dead for the rest of the process lifetime, silently, until someone
// manually restarted it. Retry with backoff at boot, then keep checking
// periodically so any shop that's active-but-unconnected (this query
// failed, initSession failed, or a socket died some other way) self-heals
// without a manual restart.
async function fetchActiveWhatsAppShopIds(): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("clients_channels")
    .select("shop_id")
    .eq("channel_type", "whatsapp")
    .eq("is_active", true);

  if (error) {
    logger.error({ err: error }, "failed to query active WhatsApp sessions");
    return null;
  }

  return (data ?? []).map((row) => row.shop_id);
}

async function reconcileActiveSessions(): Promise<void> {
  const shopIds = await fetchActiveWhatsAppShopIds();
  if (shopIds === null) return;

  const missing = shopIds.filter((shopId) => !whatsAppManager.getSocket(shopId));
  for (const shopId of missing) {
    whatsAppManager.initSession(shopId).catch((err) => {
      logger.error({ err, shopId }, "failed to init WhatsApp session during reconcile");
    });
  }
  if (missing.length > 0) {
    logger.info(`reconcile: reconnecting ${missing.length} shop(s) missing a live socket`);
  }
}

async function restoreActiveSessionsWithRetry(): Promise<void> {
  const delays = [0, 5_000, 15_000, 45_000];
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const shopIds = await fetchActiveWhatsAppShopIds();
    if (shopIds !== null) {
      for (const shopId of shopIds) {
        whatsAppManager.initSession(shopId).catch((err) => {
          logger.error({ err, shopId }, "failed to init WhatsApp session on boot");
        });
      }
      logger.info(`restoring ${shopIds.length} active WhatsApp session(s)`);
      return;
    }
  }
  logger.error("failed to restore WhatsApp sessions after retries — will retry via periodic reconcile");
}

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`bot-server listening on http://0.0.0.0:${PORT}`);
  restoreActiveSessionsWithRetry().catch((err) => logger.error({ err }, "restoreActiveSessionsWithRetry failed"));
  setInterval(() => {
    reconcileActiveSessions().catch((err) => logger.error({ err }, "reconcileActiveSessions failed"));
  }, RECONCILE_INTERVAL_MS);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down");
  process.exit(0);
});
