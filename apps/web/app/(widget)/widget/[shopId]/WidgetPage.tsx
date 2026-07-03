'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, MicOff, Mic, MessageSquare, Mic2, Send } from 'lucide-react';
import { useVoiceSession } from '@/hooks/useVoiceSession';

interface Props {
  shopId: string;
  shopName: string;
  systemPrompt?: string;
  greetingMessage?: string;
  themeColor: string;
  language: string;
  voice: string;
  aiModel?: string;
  trainingData?: string;
  collectFields?: { name: boolean; phone: boolean; address: boolean };
  category?: string;
  defaultMode?: 'voice' | 'chat';
  voiceEnabled?: boolean;
  chatEnabled?: boolean;
  isLocked?: boolean;
  country?: string;
  requirePhone?: boolean;
  autostart?: boolean;
  whiteLabel?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
}

export function WidgetPage({ shopId, shopName, systemPrompt, greetingMessage, themeColor, language, voice, aiModel, trainingData, collectFields, category, defaultMode = 'voice', voiceEnabled = true, chatEnabled = true, isLocked = false, country = 'BD', requirePhone = false, autostart = false, whiteLabel = false }: Props) {
  const { state, transcript, duration, isMuted, inputLevel, limitError, connect, disconnect, toggleMute, reset } = useVoiceSession();

  const [mode, setMode] = useState<'voice' | 'chat'>(defaultMode);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Phone gate ─────────────────────────────────────────────
  const [leadPhone, setLeadPhone] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);

  // Restore phone from sessionStorage so they don't re-enter on tab switch / refresh
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`kb-lead-${shopId}`);
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.phone && p?.leadId) {
          setLeadPhone(p.phone);
          setLeadId(p.leadId);
        }
      }
    } catch {}
  }, [shopId]);

  const phoneMaxLen = country === 'BD' ? 11 : 15;
  const phoneHint   = country === 'BD' ? 'e.g. 01712345678' : 'e.g. 5551234567';

  async function submitPhone() {
    const digits = phoneInput.replace(/\D+/g, '');
    if (country === 'BD' && (digits.length !== 11 || !digits.startsWith('01'))) {
      setPhoneError('Please enter an 11-digit number starting with 01');
      return;
    }
    if (country !== 'BD' && (digits.length < 7 || digits.length > 15)) {
      setPhoneError('Please enter a valid phone number');
      return;
    }
    setPhoneError(null);
    setPhoneSubmitting(true);
    try {
      const res = await fetch('/api/widget-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, phone: digits, country, source: `widget_${mode}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error || 'Could not save number. Try again.');
        return;
      }
      setLeadPhone(data.phone);
      setLeadId(data.leadId);
      try {
        sessionStorage.setItem(`kb-lead-${shopId}`, JSON.stringify({ phone: data.phone, leadId: data.leadId }));
      } catch {}
    } catch {
      setPhoneError('Network error. Please try again.');
    } finally {
      setPhoneSubmitting(false);
    }
  }

  const isIdle       = state === 'idle';
  const isConnecting = state === 'connecting';
  const isActive     = state === 'connected';
  const isEnded      = state === 'ended' || state === 'error';
  const pulseScale   = isActive ? 1 + inputLevel * 0.5 : 1;
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startCall = () => connect({ shopId, shopName, systemPrompt, greetingMessage, language: language as any, voice, trainingData, collectFields, category, whiteLabel, leadId: leadId ?? undefined, leadPhone: leadPhone ?? undefined } as any);

  // Scroll to bottom on new chat message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when switching to chat
  useEffect(() => {
    if (mode === 'chat') setTimeout(() => inputRef.current?.focus(), 100);
  }, [mode]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    const pendingMsg: ChatMessage = { id: Date.now().toString() + 'p', role: 'assistant', text: '…', pending: true };
    setChatMessages(prev => [...prev, userMsg, pendingMsg]);
    setChatLoading(true);

    try {
      const history = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/widget-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, message: text, history, leadId, leadPhone }),
      });
      const data = await res.json();
      setChatMessages(prev => [
        ...prev.filter(m => !m.pending),
        { id: Date.now().toString() + 'r', role: 'assistant', text: data.reply ?? 'Sorry, I could not respond.' },
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev.filter(m => !m.pending),
        { id: Date.now().toString() + 'e', role: 'assistant', text: 'Connection error. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const gateActive = requirePhone && !leadPhone && !isLocked;
  const showTabs = voiceEnabled && chatEnabled && !isLocked && !gateActive;

  const autostartedRef = useRef(false);
  useEffect(() => {
    if (autostart && mode === 'voice' && state === 'idle' && !isLocked && !gateActive && !autostartedRef.current) {
      autostartedRef.current = true;
      startCall();
    }
  });

  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden touch-none"
      style={{ background: '#0f1219', fontFamily: 'system-ui, sans-serif' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 shrink-0"
        style={{
          background: '#161b26',
          borderBottom: '1px solid #1e2533',
          padding: '14px 16px',
          paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${themeColor}18` }}>
          <div className="w-3 h-3 rounded-full" style={{ background: themeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[15px] font-semibold leading-tight truncate">{shopName}</p>
          <p className="text-gray-500 text-[11px] mt-0.5">AI Assistant</p>
        </div>
        {isActive && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: `${themeColor}15` }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: themeColor }} />
            <span className="text-white text-xs font-mono">{formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {isLocked ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2 animate-pulse">
            <span className="text-3xl">🔒</span>
          </div>
          <p className="text-red-400 text-sm font-semibold">Assistant Inactive</p>
          <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
            This business assistant is currently inactive. Please complete the subscription payment to reactivate it.
          </p>
        </div>
      ) : gateActive ? (
        /* ── PHONE GATE (only if shop enabled requirePhone) ── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 overflow-hidden">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${themeColor}18` }}>
            <Phone size={26} style={{ color: themeColor }} />
          </div>
          <div className="text-center max-w-[260px]">
            <p className="text-white text-base font-semibold mb-1.5">Enter your phone number</p>
            <p className="text-gray-500 text-xs leading-relaxed">
              We&apos;ll use this to follow up if needed. {country === 'BD' ? '11 digits, no country code.' : 'Local number only.'}
            </p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); submitPhone(); }}
            className="w-full max-w-[280px] flex flex-col gap-2.5"
          >
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              value={phoneInput}
              onChange={(e) => {
                const v = e.target.value.replace(/\D+/g, '').slice(0, phoneMaxLen);
                setPhoneInput(v);
                if (phoneError) setPhoneError(null);
              }}
              placeholder={phoneHint}
              className="w-full rounded-xl px-4 py-3 text-center text-white text-base font-medium tracking-wider placeholder-gray-600 focus:outline-none"
              style={{ background: '#1a2030', border: `1px solid ${phoneError ? '#ef4444' : '#252d3d'}` }}
              onFocus={(e) => (e.target.style.borderColor = themeColor + '80')}
              onBlur={(e) => (e.target.style.borderColor = phoneError ? '#ef4444' : '#252d3d')}
            />
            {phoneError && (
              <p className="text-red-400 text-[11px] text-center">{phoneError}</p>
            )}
            <button
              type="submit"
              disabled={phoneSubmitting || phoneInput.length === 0}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: themeColor, color: '#fff', boxShadow: `0 4px 20px ${themeColor}40` }}
            >
              {phoneSubmitting ? 'Saving…' : `Continue to ${mode === 'chat' ? 'Chat' : 'Voice Call'}`}
            </button>
          </form>
          <p className="text-[10px] text-gray-700 text-center max-w-[240px] mt-1">
            Your number stays with this business only.
          </p>
        </div>
      ) : (
        <>
          {/* ── VOICE MODE ── */}
          {mode === 'voice' && (
            <div className="flex-1 flex flex-col items-center justify-center px-5 overflow-hidden">
              {/* Orb */}
              <div className="relative flex items-center justify-center mb-5">
                {isActive && (
                  <div
                    className="absolute rounded-full transition-transform duration-75"
                    style={{
                      width: 130, height: 130,
                      transform: `scale(${pulseScale})`,
                      background: `radial-gradient(circle, ${themeColor}20 0%, transparent 70%)`,
                      border: `2px solid ${themeColor}25`,
                    }}
                  />
                )}
                <button
                  onClick={isActive ? disconnect : (isEnded && !limitError) ? (() => reset()) : limitError ? undefined : startCall}
                  disabled={isConnecting || !!limitError}
                  className="relative z-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    width: 88, height: 88,
                    background: limitError ? '#374151' : isActive ? '#ef4444' : isConnecting ? `${themeColor}60` : themeColor,
                    boxShadow: limitError ? 'none' : `0 0 30px ${isActive ? '#ef444430' : themeColor + '30'}`,
                  }}
                >
                  {isActive ? <PhoneOff size={32} className="text-white" />
                   : isConnecting ? <div className="w-7 h-7 border-white/30 border-t-white rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
                   : limitError ? <span className="text-2xl">🔒</span>
                   : <Phone size={32} className="text-white" />}
                </button>
              </div>

              {/* Status */}
              <div className="text-center mb-4 min-h-[1.25rem]">
                {isIdle && !limitError && <p className="text-gray-500 text-sm">Tap to start a call</p>}
                {isConnecting && <p className="text-gray-400 text-sm animate-pulse">Connecting…</p>}
                {isEnded && !limitError && <p className="text-gray-500 text-sm">Call ended · {formatDuration(duration)}</p>}
                {state === 'error' && !limitError && <p className="text-red-400 text-sm">Connection failed. Tap to retry.</p>}
              </div>

              {/* Mute */}
              {isActive && (
                <button
                  onClick={toggleMute}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all mb-4"
                  style={{
                    background: isMuted ? '#f59e0b15' : '#ffffff10',
                    color: isMuted ? '#f59e0b' : '#9ca3af',
                    border: `1px solid ${isMuted ? '#f59e0b30' : '#ffffff15'}`,
                  }}
                >
                  {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              )}

              {/* Transcript */}
              {(isActive || isEnded) && (
                <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ background: '#161b26', border: '1px solid #1e2533' }}>
                  <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: '#1e2533' }}>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider flex-1">Transcript</p>
                    {isActive && !transcript.some(m => m.role === 'assistant') && (
                      <span className="text-[10px] text-gray-600 animate-pulse">Waiting…</span>
                    )}
                  </div>
                  <TranscriptScroller transcript={transcript} themeColor={themeColor} isActive={isActive} />
                </div>
              )}

              {limitError && (
                <div className="text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🔒</span>
                  </div>
                  <p className="text-red-400 text-sm font-semibold mb-1">Call Limit Reached</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{limitError}</p>
                </div>
              )}

              {isIdle && !limitError && (
                <p className="text-center text-gray-600 text-xs max-w-[240px] leading-relaxed mt-2">
                  {greetingMessage ?? 'Talk to our AI assistant — ask questions, place orders, or get help.'}
                </p>
              )}
            </div>
          )}

          {/* ── CHAT MODE ── */}
          {mode === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 touch-auto">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `${themeColor}18` }}>
                      <MessageSquare size={20} style={{ color: themeColor }} />
                    </div>
                    <p className="text-gray-400 text-sm text-center max-w-xs">
                      {greetingMessage ?? 'Hi! How can I help you today?'}
                    </p>
                  </div>
                )}

                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
                      style={msg.role === 'user'
                        ? { background: themeColor, color: '#fff', borderBottomRightRadius: 4 }
                        : { background: '#161b26', color: msg.pending ? '#6b7280' : '#e5e7eb', border: '1px solid #1e2533', borderBottomLeftRadius: 4 }
                      }
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid #1e2533' }}>
                <form
                  onSubmit={e => { e.preventDefault(); sendMessage(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
                    style={{ background: '#1a2030', border: '1px solid #252d3d' }}
                    onFocus={e => e.target.style.borderColor = themeColor + '60'}
                    onBlur={e => e.target.style.borderColor = '#252d3d'}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || chatLoading}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: themeColor }}
                  >
                    <Send size={16} className="text-white" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Bottom tab bar ── */}
      <div
        className="shrink-0"
        style={{
          background: '#0f1219',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        }}
      >
        {showTabs && (
          <div className="flex items-center justify-center gap-3 px-5 pt-3 pb-1">
            <button
              onClick={() => setMode('voice')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all active:scale-95"
              style={mode === 'voice' ? {
                background: `${themeColor}`,
                color: '#fff',
                boxShadow: `0 4px 20px ${themeColor}50`,
              } : {
                background: '#1a2030',
                color: '#6b7280',
                border: '1px solid #252d3d',
              }}
            >
              <Phone size={18} strokeWidth={2.2} />
              <span className="text-sm font-semibold">Voice</span>
            </button>
            <button
              onClick={() => setMode('chat')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all active:scale-95"
              style={mode === 'chat' ? {
                background: `${themeColor}`,
                color: '#fff',
                boxShadow: `0 4px 20px ${themeColor}50`,
              } : {
                background: '#1a2030',
                color: '#6b7280',
                border: '1px solid #252d3d',
              }}
            >
              <MessageSquare size={18} strokeWidth={2.2} />
              <span className="text-sm font-semibold">Chat</span>
            </button>
          </div>
        )}
        {!whiteLabel && (
          <div className="flex justify-center pt-1.5 pb-0.5">
            <a href="https://kothabot.ai.bd" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-700 hover:text-gray-500 transition-colors">
              Powered by <span style={{ color: themeColor }}>KothaBot</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Auto-scrolling AI transcript ───────────────────────────────── */
function TranscriptScroller({
  transcript,
  themeColor,
  isActive,
}: {
  transcript: { id: string; role: string; text: string; final: boolean }[];
  themeColor: string;
  isActive: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const aiMessages = transcript.filter(m => m.role === 'assistant');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages.length, aiMessages[aiMessages.length - 1]?.text]);

  return (
    <div className="p-3 space-y-2 max-h-52 overflow-y-auto flex flex-col">
      {aiMessages.length === 0 && isActive && (
        <p className="text-xs text-gray-600 text-center py-3">Start speaking — the AI will respond shortly.</p>
      )}
      {aiMessages.map(msg => (
        <div key={msg.id} className="flex justify-start">
          <div
            className={`max-w-[92%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm text-white leading-relaxed ${!msg.final ? 'opacity-50' : ''}`}
            style={{ background: `${themeColor}25`, borderLeft: `2px solid ${themeColor}` }}
          >
            {msg.text || '…'}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
