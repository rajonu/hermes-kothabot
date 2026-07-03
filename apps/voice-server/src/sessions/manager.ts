import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { VoiceSession, ClientMessage, ServerMessage, TranscriptEntry, SessionEndReason } from './types.js';
import { startLiveSession, summarizeTranscript } from '../gemini/client.js';

const CHUNK_INTERVAL_MS = 90_000;         // 90 seconds per Gemini session
const INACTIVITY_TIMEOUT_MS = 40_000;     // end call after 40s silence
const INACTIVITY_POST_ORDER_MS = 12_000;  // 12s after order confirmed
const FAREWELL_FALLBACK_MS   = 10_000;    // force-end if AI doesn't speak farewell in time
const MAX_TRANSCRIPT_TOKENS_ESTIMATE = 4000; // rough estimate: start chunk early if verbose

// ── Hard call-duration cap (cost/abuse protection) ──────────────────────────
const MAX_CALL_DURATION_MS = 5 * 60_000;  // default 5 minutes
const CALL_WARNING_BEFORE_MS = 30_000;    // 30s before the cap → spoken warning

// ── Plan-based duration caps (seconds) ─────────────────────────────────────
const PLAN_DURATION_CAPS: Record<string, number> = {
  trial:    180,   // 3 minutes
  starter:  300,   // 5 minutes
  pro:      480,   // 8 minutes
  business: 720,   // 12 minutes
};

// ── Off-topic detection & 3-strike system ──────────────────────────────────
const OFF_TOPIC_LIMIT = 3;

// Patterns that detect the AI's scope-refusal responses (both languages).
// Must stay broad enough to catch the actual AI output — test against real
// transcripts when adding a new language or changing the system prompt.
const OFF_TOPIC_REFUSAL_PATTERNS = [
  // English
  /I can only (help|assist) with/i,
  /only assist with (business|company)/i,
  /can only help with .* (service|product|order|appointment)/i,
  /intended only for business/i,
  /only here to help with/i,
  /not able to (help|assist) with that/i,
  /can('t| not) (help|assist) with (that|this)/i,

  // Bangla — "only … services/appointments" (matches the actual AI output like
  // "শুধুমাত্র Alliance Dental Care-এর পরিষেবা")
  /শুধুমাত্র .{0,60}(সেবা|পরিষেবা|সার্ভিস|অ্যাপয়েন্টমেন্ট|প্রশ্ন)/i,
  /আমি (শুধু|কেবল|শুধুমাত্র)/i,
  /শুধুমাত্র ব্যবসা/i,
  /শুধুমাত্র প্রতিষ্ঠানের/i,
  /ব্যবসায়িক সহায়তার জন্য/i,
  /এই বিষয়ে সাহায্য করতে পারব না/i,
  /এটি আমার আওতার বাইরে/i,
];

// ── Web API base for posting transcripts on phone-call hangup ───────────────
// (Widget flow saves from the browser; phone flow has no browser, so the
//  voice-server itself fires the save-session POST here.)
const KOTHABOT_WEB_URL = process.env.KOTHABOT_WEB_URL || 'http://127.0.0.1:3000';

// ── In-memory session store ─────────────────────────────────────────────────
const sessions = new Map<string, ManagedSession>();

interface ManagedSession {
  meta: VoiceSession;
  ws: WebSocket;
  geminiSession: any;   // live session handle
  chunkTimer: NodeJS.Timeout;
  inactivityTimer: NodeJS.Timeout;
  maxDurationTimer: NodeJS.Timeout;  // hard cap — fires regardless of activity
  warningTimer: NodeJS.Timeout;      // spoken "nearing end" warning before cap
  warned: boolean;                   // prevents repeated warnings
  inactivityMs: number;      // current inactivity window (shortens after order)
  isChunking: boolean;
  callCompleteScheduled: boolean;  // prevents double-ending
  orderConfirmed: boolean;   // true after order detected → shorter inactivity
  offTopicCount: number;     // 3-strike counter for off-topic messages
  endReason: SessionEndReason;  // why the session ended
  taskCompleted: boolean;    // true after order/appointment confirmed + "anything else?" asked
}

// ── Send a typed message to the browser ────────────────────────────────────
function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Create and store a managed session ─────────────────────────────────────
export async function createSession(
  ws: WebSocket,
  shopId: string,
  config: VoiceSession['config'],
  apiKey: string
): Promise<string> {
  const sessionId = uuidv4();

  const meta: VoiceSession = {
    id: sessionId,
    shopId,
    config,
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
    chunkCount: 0,
    conversationSummary: '',
    transcript: [],
  };

  // Start the first Gemini Live session
  const geminiSession = await connectGemini(sessionId, ws, meta, apiKey);

  // Hard duration cap — plan-based → config override → default 5 min.
  const planId = (config as any)?.planId ?? 'trial';
  const planCap = PLAN_DURATION_CAPS[planId];
  const cfgMax = (config as any)?.maxCallSeconds;
  const maxDurationMs = typeof cfgMax === 'number' && cfgMax > 0
    ? Math.min(Math.max(cfgMax * 1000, 60_000), 15 * 60_000)
    : planCap ? planCap * 1000
    : MAX_CALL_DURATION_MS;

  const chunkTimer = setTimeout(() => doChunk(sessionId, apiKey), CHUNK_INTERVAL_MS);
  const inactivityTimer = setTimeout(() => sendFarewellAndEnd(sessionId, 'inactivity'), INACTIVITY_TIMEOUT_MS);
  const warningTimer = setTimeout(
    () => sendDurationWarning(sessionId),
    Math.max(maxDurationMs - CALL_WARNING_BEFORE_MS, 5_000)
  );
  const maxDurationTimer = setTimeout(
    () => sendFarewellAndEnd(sessionId, 'max_duration'),
    maxDurationMs
  );

  sessions.set(sessionId, {
    meta,
    ws,
    geminiSession,
    chunkTimer,
    inactivityTimer,
    maxDurationTimer,
    warningTimer,
    warned: false,
    inactivityMs: INACTIVITY_TIMEOUT_MS,
    isChunking: false,
    callCompleteScheduled: false,
    orderConfirmed: false,
    offTopicCount: 0,
    endReason: 'completed',
    taskCompleted: false,
  });

  console.log(`[session ${sessionId}] hard cap = ${Math.round(maxDurationMs / 1000)}s`);
  return sessionId;
}

// ── Spoken warning ~30s before the hard cap ─────────────────────────────────
function sendDurationWarning(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s || s.warned || s.callCompleteScheduled) return;
  s.warned = true;
  const shopName = s.meta.config.shopName || 'us';
  console.log(`[session ${sessionId}] duration warning`);
  try {
    s.geminiSession?.sendClientContent?.({
      turns: [{
        role: 'user',
        parts: [{
          text: `[System: This call is nearing its time limit. In one short sentence, tell the customer the call is about to end and ask if there's anything else about ${shopName} you can quickly help with. Do not say goodbye yet.]`
        }]
      }],
      turnComplete: true,
    });
  } catch (err: any) {
    console.warn(`[session ${sessionId}] warning send error:`, err.message);
  }
}

// ── Off-topic detection: check AI output for scope refusal ─────────────────
function checkOffTopicRefusal(sessionId: string, aiText: string) {
  const s = sessions.get(sessionId);
  if (!s || s.callCompleteScheduled) return;

  const isRefusal = OFF_TOPIC_REFUSAL_PATTERNS.some(p => p.test(aiText));
  if (!isRefusal) return;

  s.offTopicCount++;
  console.log(`[session ${sessionId}] off-topic strike ${s.offTopicCount}/${OFF_TOPIC_LIMIT}`);

  if (s.offTopicCount >= OFF_TOPIC_LIMIT) {
    // 3rd strike — end the session
    s.endReason = 'off_topic_limit';
    const lang = s.meta.config.language;
    const msg = lang === 'bn'
      ? 'এই সহায়কটি শুধুমাত্র ব্যবসায়িক সহায়তার জন্য ব্যবহৃত হয়। সেশন সমাপ্ত করা হচ্ছে।'
      : 'This assistant is intended only for business support. Ending the session.';

    try {
      s.geminiSession?.sendClientContent?.({
        turns: [{ role: 'user', parts: [{ text: `[System: Say exactly this and nothing else: "${msg}"]` }] }],
        turnComplete: true,
      });
    } catch {}

    // Force end after a short delay for the farewell to play
    setTimeout(() => endSession(sessionId, 'off_topic_limit'), 5000);
  }
}

// ── Connect (or reconnect) to Gemini Live for a session ────────────────────
async function connectGemini(
  sessionId: string,
  ws: WebSocket,
  meta: VoiceSession,
  apiKey: string,
  isFirstConnection = true
): Promise<any> {
  return startLiveSession(apiKey, meta.config, meta.conversationSummary, {
    onAudio: (base64Pcm) => {
      send(ws, { type: 'AUDIO_CHUNK', data: base64Pcm });
      resetInactivity(sessionId, apiKey);
    },
    onTranscript: (role, text, final) => {
      if (!text.trim()) return;
      // Send ALL messages to browser (both user and assistant) so chat displays correctly
      send(ws, { type: 'TRANSCRIPT', role, text, final });

      if (final) {
        // Always push a new entry — every final utterance is a distinct turn.
        // Do NOT upsert same-role: user/AI may speak multiple turns in sequence.
        meta.transcript.push({ role, text, timestamp: Date.now() });
        const estimatedTokens = meta.transcript.reduce((s, e) => s + e.text.length, 0) / 4;
        if (estimatedTokens > MAX_TRANSCRIPT_TOKENS_ESTIMATE) doChunk(sessionId, apiKey);
        // After order confirmed, each user utterance tightens the inactivity window
        if (role === 'user') onUserSpeechAfterOrder(sessionId);
        // Off-topic detection: check AI responses for scope-refusal patterns
        if (role === 'assistant') checkOffTopicRefusal(sessionId, text);
      }
      resetInactivity(sessionId, apiKey);
    },
    onCallComplete: () => {
      const s = sessions.get(sessionId);
      if (!s || s.callCompleteScheduled) return;
      s.callCompleteScheduled = true;
      console.log(`[session ${sessionId}] call complete — ending in 3s`);
      // Wait 3s to let final audio finish playing before closing
      setTimeout(() => endSession(sessionId, 'call_complete'), 3000);
    },
    onOrderConfirmed: () => {
      const s = sessions.get(sessionId);
      if (!s || s.orderConfirmed) return;
      s.orderConfirmed = true;
      console.log(`[session ${sessionId}] order confirmed — inactivity → ${INACTIVITY_POST_ORDER_MS / 1000}s`);
      s.inactivityMs = INACTIVITY_POST_ORDER_MS;
      resetInactivity(sessionId, apiKey);
    },
    onError: (err) => {
      console.error(`[session ${sessionId}] Gemini error:`, err.message);
      send(ws, { type: 'ERROR', code: 'GEMINI_ERROR', message: err.message });
    },
    onClose: () => {
      const s = sessions.get(sessionId);
      if (!s || s.isChunking || s.callCompleteScheduled) return;
      console.log(`[session ${sessionId}] Gemini closed — auto-reconnecting...`);
      connectGemini(sessionId, ws, s.meta, apiKey, false)
        .then(newSession => {
          const current = sessions.get(sessionId);
          if (current) current.geminiSession = newSession;
          console.log(`[session ${sessionId}] reconnected`);
        })
        .catch(err => {
          console.error(`[session ${sessionId}] reconnect failed:`, err.message);
          endSession(sessionId, 'reconnect_failed');
        });
    },
  }, isFirstConnection);
}

// ── Session chunking: summarize + restart Gemini session ───────────────────
async function doChunk(sessionId: string, apiKey: string) {
  const s = sessions.get(sessionId);
  if (!s || s.isChunking) return;

  console.log(`[session ${sessionId}] chunking (chunk #${s.meta.chunkCount + 1})`);
  s.isChunking = true;

  // Clear chunk timer (will reschedule after new session starts)
  clearTimeout(s.chunkTimer);

  try {
    // 1. Close the current Gemini session gracefully
    try { s.geminiSession?.close?.(); } catch {}

    // 2. Summarize the transcript so far
    if (s.meta.transcript.length > 0) {
      const summary = await summarizeTranscript(apiKey, s.meta.transcript);
      s.meta.conversationSummary = summary;
      console.log(`[session ${sessionId}] summary (${summary.length} chars)`);
    }

    s.meta.chunkCount++;

    // 3. Notify browser of the reset
    send(s.ws, { type: 'CHUNK_RESET' });

    // 4. Start a fresh Gemini session with the summary as context.
    // isFirstConnection=false prevents the greeting from replaying mid-call.
    s.geminiSession = await connectGemini(sessionId, s.ws, s.meta, apiKey, false);
    s.isChunking = false;

    // 5. Reschedule the next chunk
    s.chunkTimer = setTimeout(() => doChunk(sessionId, apiKey), CHUNK_INTERVAL_MS);

    console.log(`[session ${sessionId}] chunk complete — new Gemini session started`);
  } catch (err: any) {
    console.error(`[session ${sessionId}] chunk failed:`, err.message);
    s.isChunking = false;
    send(s.ws, { type: 'ERROR', code: 'CHUNK_FAILED', message: 'Voice quality reset failed. Continuing...' });
    // Reschedule anyway
    s.chunkTimer = setTimeout(() => doChunk(sessionId, apiKey), CHUNK_INTERVAL_MS);
  }
}

// ── Send farewell greeting via AI then end the session ─────────────────────
// Instead of cutting the call silently on inactivity, we ask the AI to say
// a warm goodbye. The AI speaks it, then says "END CALL" which triggers the
// normal onCallComplete → endSession flow.
// A hard fallback fires after FAREWELL_FALLBACK_MS in case the AI doesn't respond.
function sendFarewellAndEnd(sessionId: string, reason: string) {
  const s = sessions.get(sessionId);
  if (!s || s.callCompleteScheduled) return;

  s.callCompleteScheduled = true; // prevent double-ending

  // Map reason to SessionEndReason
  if (reason === 'inactivity') s.endReason = 'silence_timeout';
  else if (reason === 'max_duration') s.endReason = 'time_limit';
  else if (reason === 'off_topic_limit') s.endReason = 'off_topic_limit';

  const shopName = s.meta.config.shopName || 'us';
  const lang = s.meta.config.language;

  console.log(`[session ${sessionId}] farewell (reason: ${reason})`);

  // Choose farewell message based on reason and language
  let farewellText: string;
  if (reason === 'max_duration') {
    farewellText = lang === 'bn'
      ? `আপনার নির্ধারিত কল সময় শেষ হয়েছে। প্রয়োজনে আবার কল করুন। ধন্যবাদ!`
      : `Your call time limit has been reached. Please start a new session if needed. Thank you! Goodbye!`;
  } else if (reason === 'inactivity') {
    farewellText = lang === 'bn'
      ? `কোনো কার্যক্রম শনাক্ত হয়নি। সেশন বন্ধ করা হচ্ছে। ধন্যবাদ!`
      : `No activity detected. Closing the session. Thank you for contacting ${shopName}. Goodbye!`;
  } else {
    farewellText = `Thank you for contacting ${shopName}. Have a great day! Goodbye!`;
  }

  try {
    s.geminiSession?.sendClientContent?.({
      turns: [{
        role: 'user',
        parts: [{
          text: `[System: Say this farewell and nothing else: "${farewellText}"]`
        }]
      }],
      turnComplete: true,
    });
  } catch (err: any) {
    console.warn(`[session ${sessionId}] farewell send error:`, err.message);
    endSession(sessionId, reason);
    return;
  }

  // Fallback: force-end if the AI doesn't respond or END CALL isn't detected in time
  setTimeout(() => {
    if (sessions.has(sessionId)) {
      console.log(`[session ${sessionId}] farewell fallback — force ending`);
      endSession(sessionId, reason);
    }
  }, FAREWELL_FALLBACK_MS);
}

// ── Reset inactivity timer ──────────────────────────────────────────────────
function resetInactivity(sessionId: string, _apiKey: string) {
  const s = sessions.get(sessionId);
  if (!s || s.callCompleteScheduled) return;
  clearTimeout(s.inactivityTimer);
  s.meta.lastActivityAt = Date.now();
  s.inactivityTimer = setTimeout(() => sendFarewellAndEnd(sessionId, 'inactivity'), s.inactivityMs);
}

// ── Called on any user speech after order is confirmed ──────────────────────
export function onUserSpeechAfterOrder(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s || !s.orderConfirmed || s.callCompleteScheduled) return;
  // After order, once user speaks again (their "ok/thanks"), shorten even more
  if (s.inactivityMs > 5_000) {
    s.inactivityMs = 5_000;
    resetInactivity(sessionId, '');
  }
}

// ── Forward audio from browser to Gemini ───────────────────────────────────
export function sendAudio(sessionId: string, base64Pcm: string) {
  const s = sessions.get(sessionId);
  if (!s || s.isChunking) return;

  try {
    s.geminiSession?.sendRealtimeInput?.({
      audio: { data: base64Pcm, mimeType: 'audio/pcm' }
    });
    s.meta.lastActivityAt = Date.now();
  } catch (err: any) {
    console.warn(`[session ${sessionId}] audio send error:`, err.message);
  }
}

// ── End a session cleanly ───────────────────────────────────────────────────
export function endSession(sessionId: string, reason: string = 'client_ended') {
  const s = sessions.get(sessionId);
  if (!s) return;

  // Map raw reason string to typed SessionEndReason (if not already set)
  if (reason === 'client_ended') s.endReason = 'user_requested_end';
  else if (reason === 'call_complete') s.endReason = 'completed';
  else if (reason === 'ws_disconnected') s.endReason = 'ws_disconnected';
  else if (reason === 'reconnect_failed') s.endReason = 'system_end';
  // inactivity / max_duration / off_topic_limit already set in sendFarewellAndEnd

  console.log(`[session ${sessionId}] ending (reason: ${reason}, endReason: ${s.endReason})`);

  clearTimeout(s.chunkTimer);
  clearTimeout(s.inactivityTimer);
  clearTimeout(s.maxDurationTimer);
  clearTimeout(s.warningTimer);

  try { s.geminiSession?.close?.(); } catch {}

  const duration = Math.round((Date.now() - s.meta.startedAt) / 1000);
  console.log(`[session ${sessionId}] ending — duration=${duration}s transcript_entries=${s.meta.transcript.length} endReason=${s.endReason} offTopic=${s.offTopicCount}`);
  if (s.meta.transcript.length > 0) {
    console.log(`[session ${sessionId}] transcript sample:`, s.meta.transcript.slice(0, 3).map(e => `[${e.role}] ${e.text.slice(0, 80)}`).join(' | '));
  }
  send(s.ws, {
    type: 'SESSION_ENDED',
    duration,
    transcript: s.meta.transcript,
    shopId: s.meta.shopId,
    endReason: s.endReason,
    offTopicCount: s.offTopicCount,
  });

  // ── Phone-call save-session (browser-less flow) ──────────────────────────
  // Widget sessions are saved by the browser hook (useVoiceSession.ts).
  // Phone sessions have no browser, so the voice-server POSTs the transcript
  // itself. Fire-and-forget — failure must not block session cleanup.
  const source = (s.meta.config as any)?.source;
  if (source === 'phone' && s.meta.transcript.length > 0) {
    const payload = {
      shopId:        s.meta.shopId,
      duration,
      transcript:    s.meta.transcript,
      endReason:     s.endReason,
      offTopicCount: s.offTopicCount,
      source:        'phone',
      callerDid:     (s.meta.config as any)?.callerDid ?? null,
    };
    fetch(`${KOTHABOT_WEB_URL}/api/voice/save-session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(r => r.json().catch(() => ({})))
      .then(j => console.log(`[session ${sessionId}] phone save-session ->`, j))
      .catch(err => console.error(`[session ${sessionId}] phone save-session failed:`, err?.message ?? err));
  }

  sessions.delete(sessionId);
}

// ── Get session metadata (for Supabase logging) ─────────────────────────────
export function getSession(sessionId: string): VoiceSession | undefined {
  return sessions.get(sessionId)?.meta;
}

// ── Cleanup all sessions for a WebSocket connection ────────────────────────
export function cleanupByWs(ws: WebSocket) {
  for (const [id, s] of sessions.entries()) {
    if (s.ws === ws) {
      endSession(id, 'ws_disconnected');
    }
  }
}
