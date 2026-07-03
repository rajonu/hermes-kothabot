'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'ending' | 'ended' | 'error';

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
  timestamp: number;
}

interface SessionConfig {
  shopId: string;
  voice?: string;
  language?: 'bn' | 'en' | 'auto';
  shopName?: string;
  systemPrompt?: string;
  greetingMessage?: string;
  /** Admin-selected Gemini model, e.g. 'models/gemini-3.1-flash-live-preview' */
  aiModel?: string;
  /** Layer 4: Training data (FAQs, product info) — capped server-side */
  trainingData?: string;
  /** Which customer fields to collect during order */
  collectFields?: { name: boolean; phone: boolean; address: boolean };
  /** Shop category — drives category-aware AI behavior */
  category?: string;
  /** Layer 3: Category-specific rules fetched from DB */
  categoryRules?: string;
}

const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL ?? 'wss://voice-server.up.railway.app';

// ── Rules caching helpers (localStorage, 5-minute TTL) ───────────────────────
// Avoids re-fetching global/category rules on every call — they rarely change.
const RULES_TTL = 5 * 60 * 1000;

function getCachedRule(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { v, exp } = JSON.parse(raw);
    if (Date.now() > exp) { localStorage.removeItem(key); return null; }
    return v as string;
  } catch { return null; }
}

function setCachedRule(key: string, value: string) {
  try { localStorage.setItem(key, JSON.stringify({ v: value, exp: Date.now() + RULES_TTL })); } catch {}
}

async function fetchGlobalRules(shopName: string): Promise<string> {
  const CACHE_KEY = 'kb_v1_global_rules';
  let raw: string = getCachedRule(CACHE_KEY) ?? '';
  if (!raw) {
    try {
      const r = await fetch('/api/voice/global-rules');
      raw = r.ok ? ((await r.json()).rules ?? '') : '';
      if (raw) setCachedRule(CACHE_KEY, raw);
    } catch { raw = ''; }
  }
  return raw
    .replace(/\[Business Name\]/g, shopName || 'this business')
    .replace(/={10,}\s*👋 GREETING RULES[\s\S]*?(?=={10,}|$)/i, '');
}

async function fetchCategoryRules(category?: string): Promise<string> {
  if (!category) return '';
  const CACHE_KEY = `kb_v1_cat_${category}`;
  const cached = getCachedRule(CACHE_KEY);
  if (cached !== null) return cached;
  try {
    const r = await fetch(`/api/voice/category-rules?category=${encodeURIComponent(category)}`);
    const rules = r.ok ? ((await r.json()).rules ?? '') : '';
    setCachedRule(CACHE_KEY, rules);
    return rules;
  } catch { return ''; }
}

async function fetchResumeContext(shopId: string): Promise<string> {
  try {
    const data = await fetch(`/api/voice/recent-session?shopId=${shopId}`).then(r => r.json());
    if (!data.transcript?.length) return '';
    const lines = data.transcript
      .filter((t: any) => t.text?.trim())
      .map((t: any) => `${t.role === 'assistant' ? 'AI' : 'Customer'}: ${t.text}`)
      .join('\n');
    return `\n\n## Previous conversation (${Math.round(data.duration / 60)}min ago — continue from here):\n${lines}\n\nNote: The customer called back. Resume naturally without re-introducing yourself.`;
  } catch { return ''; }
}

// ── Inline AudioWorklet processor (PCM capture) ─────────────────────────────
const PROCESSOR_CODE = `
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const buf = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      buf[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)));
    }
    this.port.postMessage(buf.buffer, [buf.buffer]);
    return true;
  }
}
registerProcessor('pcm-processor', PcmProcessor);
`;

// ── Decode raw PCM bytes → AudioBuffer (v1-proven approach) ─────────────────
function decodePcm(bytes: Uint8Array, ctx: AudioContext, sampleRate = 24000): AudioBuffer {
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const buffer = ctx.createBuffer(1, int16.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) {
    channel[i] = int16[i] / 32768.0;
  }
  return buffer;
}

// ── base64 → Uint8Array ──────────────────────────────────────────────────────
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function useVoiceSession() {
  const [state, setState] = useState<ConnectionState>('idle');
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [limitError, setLimitError] = useState<string | null>(null);

  const wsRef            = useRef<WebSocket | null>(null);
  const transcriptRef    = useRef<TranscriptMessage[]>([]);
  const inputCtxRef      = useRef<AudioContext | null>(null);
  const outputCtxRef     = useRef<AudioContext | null>(null);
  const nextPlayTimeRef  = useRef<number>(0);
  const streamRef        = useRef<MediaStream | null>(null);
  const workletRef       = useRef<AudioWorkletNode | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const rafRef           = useRef<number | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMutedRef       = useRef(false);
  const sessionShopIdRef = useRef<string | null>(null);   // for save-session on manual end
  const sessionLeadRef = useRef<{ leadId: string | null; leadPhone: string | null }>({ leadId: null, leadPhone: null });
  const durationRef      = useRef<number>(0);             // live duration for save on disconnect
  const hasSavedRef      = useRef(false);

  // ── Level meter (runs while connected) ──────────────────────────────────────
  const startLevelMeter = useCallback(() => {
    const tick = () => {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        setInputLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Stop all audio resources ─────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    workletRef.current?.disconnect();   workletRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    inputCtxRef.current?.close();       inputCtxRef.current = null;
    outputCtxRef.current?.close();      outputCtxRef.current = null;
    nextPlayTimeRef.current = 0;
    setInputLevel(0);
  }, []);

  // ── Play one PCM audio chunk from AI ─────────────────────────────────────────
  const playChunk = useCallback((b64: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) { console.warn('[voice] outputCtx missing'); return; }
    if (ctx.state === 'suspended') { ctx.resume(); }

    try {
      const bytes  = b64ToBytes(b64);
      const buffer = decodePcm(bytes, ctx, 24000);

      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
    } catch (e) {
      console.error('[voice] playChunk error:', e);
    }
  }, []);

  // ── Start microphone capture ──────────────────────────────────────────────────
  const startMic = useCallback(async (ws: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    streamRef.current = stream;

    const inputCtx = new AudioContext({ sampleRate: 16000 });
    await inputCtx.resume();
    inputCtxRef.current = inputCtx;

    const analyser = inputCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    await inputCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const source  = inputCtx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(inputCtx, 'pcm-processor');
    workletRef.current = worklet;

    source.connect(analyser);
    source.connect(worklet);

    worklet.port.onmessage = (e: MessageEvent) => {
      if (isMutedRef.current) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      // e.data is the transferred ArrayBuffer of Int16 samples
      const bytes = new Uint8Array(e.data as ArrayBuffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      ws.send(JSON.stringify({ type: 'AUDIO_CHUNK', data: btoa(bin) }));
    };

    startLevelMeter();
  }, [startLevelMeter]);

  // ── Upsert transcript ─────────────────────────────────────────────────────────
  const upsertTranscript = useCallback((role: 'user' | 'assistant', text: string, final: boolean) => {
    setTranscript(prev => {
      const lastIdx = [...prev].reverse().findIndex(m => m.role === role && !m.final);
      const idx = lastIdx >= 0 ? prev.length - 1 - lastIdx : -1;
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], text, final };
        transcriptRef.current = updated;
        return updated;
      }
      const entry = { id: `${role}-${Date.now()}`, role, text, final, timestamp: Date.now() };
      const next = [...prev, entry];
      const trimmed = next.length > 50 ? next.slice(-50) : next;
      transcriptRef.current = trimmed;
      return trimmed;
    });
  }, []);

  // ── Save session helper (reused by normal end + drop) ────────────────────────
  const saveSessionRef = useRef<(shopId: string, dur: number, entries: any[]) => void>(() => {});

  // ── Connect ────────────────────────────────────────────────────────────────────
  const connect = useCallback(async (config: SessionConfig) => {
    if (state === 'connected' || state === 'connecting') return;

    setState('connecting');
    setTranscript([]);
    transcriptRef.current = [];
    setDuration(0);
    durationRef.current = 0;
    sessionShopIdRef.current = config.shopId;
    hasSavedRef.current = false;
    sessionLeadRef.current = {
      leadId:    (config as any).leadId    ?? null,
      leadPhone: (config as any).leadPhone ?? null,
    };

    // ── STEP 1: Create AudioContext inside user gesture (fast, ~20ms) ──────────
    const outputCtx = new AudioContext({ sampleRate: 24000 });
    await outputCtx.resume();
    outputCtxRef.current = outputCtx;
    nextPlayTimeRef.current = 0;

    // ── STEP 2: Open WebSocket AND fetch check-limit + all prompt layers IN PARALLEL ──
    // Previously: check-limit, then global-rules → category-rules → recent-session
    // were all sequential, adding ~1s+ before the WS even opened.
    // Now: WS connects concurrently with all 4 API calls. check-limit still gates
    // START_SESSION (and closes the socket if blocked) but no longer delays connecting.
    // START_SESSION is sent as soon as the WS is open, prompts are ready, AND the
    // usage limit check has cleared.

    let enrichedConfig: SessionConfig | null = null;
    let wsIsOpen = false;
    let limitCleared = false;

    const sendStartWhenReady = (ws: WebSocket) => {
      if (wsIsOpen && enrichedConfig && limitCleared) {
        ws.send(JSON.stringify({ type: 'START_SESSION', shopId: enrichedConfig.shopId, config: enrichedConfig }));
      }
    };

    try {
      const ws = new WebSocket(VOICE_SERVER_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        wsIsOpen = true;
        sendStartWhenReady(ws);
      };

      ws.onmessage = async (e) => {
        let msg: any;
        try { msg = JSON.parse(e.data); } catch { return; }

        if (msg.type === 'SESSION_READY') {
          try {
            await startMic(ws);
            setState('connected');
            durationTimerRef.current = setInterval(() => {
              durationRef.current += 1;
              setDuration(d => d + 1);
            }, 1000);
          } catch (err) {
            console.error('[voice] mic error:', err);
            setState('error');
          }
        }

        if (msg.type === 'AUDIO_CHUNK') {
          playChunk(msg.data);
        }

        if (msg.type === 'TRANSCRIPT') {
          upsertTranscript(msg.role, msg.text, msg.final);
        }

        if (msg.type === 'SESSION_ENDED') {
          const dur = msg.duration ?? durationRef.current ?? 0;
          setDuration(dur);
          setState('ended');
          cleanup();
          // Always save session
          if (msg.shopId && !hasSavedRef.current) {
            hasSavedRef.current = true;
            const entries = msg.transcript ?? [];
            const endReason = msg.endReason ?? 'completed';
            const offTopicCount = msg.offTopicCount ?? 0;
            console.log(`[voice] session ended — duration=${dur}s entries=${entries.length} reason=${endReason} offTopic=${offTopicCount}`);
            fetch('/api/voice/save-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shopId: msg.shopId, duration: dur, transcript: entries, endReason, offTopicCount, leadId: sessionLeadRef.current.leadId, leadPhone: sessionLeadRef.current.leadPhone }),
            })
            .then(r => r.json())
            .then(d => console.log('[voice] save-session result:', d))
            .catch(e => console.warn('[voice] save-session failed:', e));
          }
        }

        if (msg.type === 'ERROR') {
          console.error('[voice] server error:', msg.code, msg.message);
        }
      };

      ws.onclose = () => {
        // If call dropped unexpectedly mid-session, save what we have
        const currentTranscript = transcriptRef.current;
        const dur = durationRef.current;
        const shopId = sessionShopIdRef.current;
        if (shopId && dur > 5 && currentTranscript.length > 0 && !hasSavedRef.current) {
          hasSavedRef.current = true;
          console.log('[voice] call dropped — saving partial transcript');
          fetch('/api/voice/save-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopId, duration: dur, transcript: currentTranscript, leadId: sessionLeadRef.current.leadId, leadPhone: sessionLeadRef.current.leadPhone }),
          }).catch(() => {});
        }
        setState('ended');
        cleanup();
      };

      ws.onerror = (e) => {
        console.error('[voice] WS error:', e);
        setState('error');
        cleanup();
      };

      // ── Fetch all prompt layers + usage limit concurrently with the WS connection ──
      // global-rules and category-rules are cached in localStorage after the
      // first call, so on repeat calls these resolve in ~0ms from cache.
      let planId = 'trial';
      let maxCallSeconds = 180;
      const [globalRules, categoryRules, resumeContext, limitData] = await Promise.all([
        fetchGlobalRules(config.shopName ?? 'this business'),
        fetchCategoryRules(config.category),
        fetchResumeContext(config.shopId),
        fetch(`/api/voice/check-limit?shopId=${config.shopId}`).then(r => r.json()).catch(() => ({ allowed: true })),
      ]);

      if (!limitData.allowed) {
        setState('error');
        setLimitError(limitData.reason === 'subscription_expired'
          ? 'Your subscription has expired. Please renew your plan.'
          : 'Your usage limit has been reached. Please upgrade your plan or contact support.');
        ws.close();
        return;
      }
      if (limitData.planId) planId = limitData.planId;
      if (limitData.maxCallSeconds) maxCallSeconds = limitData.maxCallSeconds;
      limitCleared = true;

      const combinedPrompt = [
        globalRules,
        config.systemPrompt ?? '',
        resumeContext,
      ].filter(Boolean).join('\n\n');

      enrichedConfig = { ...config, systemPrompt: combinedPrompt, categoryRules: categoryRules || undefined, planId, maxCallSeconds } as any;

      // If WS already opened while we were fetching, send now; otherwise ws.onopen sends it
      sendStartWhenReady(ws);

    } catch (err) {
      console.error('[voice] connect error:', err);
      setState('error');
    }
  }, [state, startMic, playChunk, upsertTranscript]);

  const cleanup = useCallback(() => {
    stopAudio();
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
  }, [stopAudio]);

  const disconnect = useCallback(() => {
    setState('ending');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'END_SESSION' }));
    }
    setTimeout(() => { wsRef.current?.close(); cleanup(); setState('ended'); }, 500);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMutedRef.current; });
  }, []);

  const reset = useCallback(() => {
    wsRef.current?.close();
    cleanup();
    setState('idle');
    setTranscript([]);
    setDuration(0);
    setIsMuted(false);
    isMutedRef.current = false;
    setLimitError(null);
  }, [cleanup]);

  useEffect(() => () => { wsRef.current?.close(); cleanup(); }, [cleanup]);

  return { state, transcript, duration, isMuted, inputLevel, limitError, connect, disconnect, toggleMute, reset };
}
