import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { ClientMessage } from './sessions/types.js';
import { createSession, sendAudio, endSession, cleanupByWs } from './sessions/manager.js';

// Build marker: v2.7.0 build 11 — also forces Railway watchPattern to redeploy web
const PORT = parseInt(process.env.PORT ?? '8080');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);

if (!GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY is required');
  process.exit(1);
}

// ── HTTP server (for Railway health checks) ─────────────────────────────────
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// ── WebSocket server ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

// Always-allowed localhost patterns (covers any port — Next dev picks random ports).
// Avoids the "Origin not allowed" trap during local development without needing
// to keep Railway's ALLOWED_ORIGINS in sync with the day's ephemeral dev port.
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

wss.on('connection', (ws: WebSocket, req) => {
  const origin = req.headers.origin ?? '';

  // Origin check: allow if no allowlist configured, origin is localhost,
  // or origin matches the configured allowlist.
  const isLocalhost = LOCALHOST_RE.test(origin);
  const isAllowed   = ALLOWED_ORIGINS.length === 0 || isLocalhost || ALLOWED_ORIGINS.includes(origin);
  if (!isAllowed) {
    console.warn(`[ws] rejected connection from origin: ${origin}`);
    ws.close(1008, 'Origin not allowed');
    return;
  }

  console.log(`[ws] new connection from ${origin || 'unknown origin'}`);

  let activeSessionId: string | null = null;

  // ── Incoming messages from browser ────────────────────────────────────────
  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      console.warn('[ws] unparseable message');
      return;
    }

    if (msg.type === 'START_SESSION') {
      if (activeSessionId) {
        endSession(activeSessionId, 'restart');
        activeSessionId = null;
      }

      console.log(`[ws] START_SESSION shop=${msg.shopId}`);

      try {
        activeSessionId = await createSession(
          ws,
          msg.shopId,
          msg.config,
          GEMINI_API_KEY!
        );

        ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId: activeSessionId }));
        console.log(`[ws] session ready: ${activeSessionId}`);
      } catch (err: any) {
        console.error('[ws] failed to create session:', err.message);
        ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'SESSION_FAILED',
          message: 'Failed to connect to AI. Please try again.',
        }));
      }
      return;
    }

    if (msg.type === 'AUDIO_CHUNK') {
      if (activeSessionId) {
        sendAudio(activeSessionId, msg.data);
      }
      return;
    }

    if (msg.type === 'END_SESSION') {
      if (activeSessionId) {
        endSession(activeSessionId, 'client_ended');
        activeSessionId = null;
      }
      return;
    }
  });

  // ── Browser disconnected ──────────────────────────────────────────────────
  ws.on('close', () => {
    console.log(`[ws] connection closed`);
    cleanupByWs(ws);
    activeSessionId = null;
  });

  ws.on('error', (err) => {
    console.error('[ws] socket error:', err.message);
    cleanupByWs(ws);
    activeSessionId = null;
  });
});

// ── Start listening ──────────────────────────────────────────────────────────
// Bind to 0.0.0.0 explicitly so Railway's healthcheck can reach the container.
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎙️  KothaBot Voice Server`);
  console.log(`   WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`   Health:    http://0.0.0.0:${PORT}/health`);
  console.log(`   Gemini key: ${GEMINI_API_KEY!.slice(0, 8)}...`);
  console.log('');
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM — shutting down');
  wss.close(() => {
    httpServer.close(() => process.exit(0));
  });
});
