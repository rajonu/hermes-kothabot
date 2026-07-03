'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { Mic, MicOff, PhoneOff, Phone, X, MessageSquare, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
}

interface VoiceWidgetProps {
  shopId: string;
  shopName?: string;
  systemPrompt?: string;
  greetingMessage?: string;
  themeColor?: string;
  language?: 'bn' | 'en' | 'auto';
  voice?: string;
  aiModel?: string;
  trainingData?: string;
  collectFields?: { name: boolean; phone: boolean; address: boolean };
  category?: string;
  avatar?: string | null;
  inline?: boolean;
  enableVoice?: boolean;
  enableChat?: boolean;
  /** Fetch trainingData from /api/voice/widget-context at call start instead of receiving it as a prop (dashboard only) */
  lazyContext?: boolean;
}

export function VoiceWidget({
  shopId,
  shopName = 'KothaBot',
  systemPrompt,
  greetingMessage,
  themeColor = '#10b981',
  language = 'auto',
  voice = 'Aoede',
  aiModel,
  trainingData,
  collectFields,
  category,
  avatar,
  inline = false,
  enableVoice = true,
  enableChat = true,
  lazyContext = false,
}: VoiceWidgetProps) {
  const { state, transcript, duration, isMuted, inputLevel, connect, disconnect, toggleMute, reset } = useVoiceSession();
  const [showPanel, setShowPanel] = useState(false);
  const [tab, setTab] = useState<'voice' | 'chat'>(enableVoice ? 'voice' : 'chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const autoDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lazyTrainingRef = useRef<string | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  const isActive = state === 'connected' || state === 'connecting' || state === 'ending';
  const isEnded = state === 'ended' || state === 'error';

  // Auto-open panel when call starts
  useEffect(() => {
    if (state === 'connecting') setShowPanel(true);
  }, [state]);

  // Refresh dashboard data after call ends so new appointments/patients appear instantly
  useEffect(() => {
    if (state === 'ended') {
      // Give save-session ~3s to complete, then refresh all server components
      const t = setTimeout(() => router.refresh(), 3000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  // Auto-disconnect when order is confirmed
  useEffect(() => {
    if (state !== 'connected') return;

    const lastAiMessage = [...transcript].reverse().find(msg => msg.role === 'assistant' && msg.final);
    if (!lastAiMessage) return;

    const text = lastAiMessage.text.toLowerCase();
    // Detect order confirmation keywords
    const confirmationKeywords = ['order confirm', 'order placed', 'confirmed', 'thank you for your order', 'order received', 'order complete', 'goodbye', 'bye'];
    const isConfirmed = confirmationKeywords.some(keyword => text.includes(keyword));

    if (isConfirmed) {
      // Clear any existing timer
      if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
      // Auto-disconnect after 2 seconds so user can hear the confirmation
      autoDisconnectTimerRef.current = setTimeout(() => {
        disconnect();
      }, 2000);
    }
  }, [transcript, state, disconnect]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
    };
  }, []);

  // Scroll chat to bottom on new message
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { if (tab === 'chat' && showPanel) setTimeout(() => chatInputRef.current?.focus(), 100); }, [tab, showPanel]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    const pendingMsg: ChatMessage = { id: Date.now() + 'p', role: 'assistant', text: '…', pending: true };
    setChatMessages(prev => [...prev, userMsg, pendingMsg]);
    setChatLoading(true);
    try {
      const history = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const res  = await fetch('/api/widget-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopId, message: text, history }) });
      const data = await res.json();
      const reply = data.reply ?? 'Sorry, I could not respond.';
      setChatMessages(prev => [...prev.filter(m => !m.pending), { id: Date.now() + 'r', role: 'assistant', text: reply }]);
      // Refresh dashboard data if appointment was just confirmed
      const confirmPatterns = [/confirm/i, /booked/i, /look forward/i, /নিশ্চিত/i];
      if (confirmPatterns.some(p => p.test(reply))) setTimeout(() => router.refresh(), 3000);
    } catch {
      setChatMessages(prev => [...prev.filter(m => !m.pending), { id: Date.now() + 'e', role: 'assistant', text: 'Connection error. Please try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  };

  const handleCallButton = async () => {
    if (isActive) {
      disconnect();
    } else if (isEnded) {
      reset();
      setShowPanel(false);
    } else {
      let kb = trainingData;
      // Dashboard mode: knowledge base is fetched on demand (and cached) so the
      // layout doesn't have to load it on every page navigation
      if (lazyContext && kb === undefined) {
        if (lazyTrainingRef.current === undefined) {
          try {
            const res = await fetch('/api/voice/widget-context');
            const data = await res.json();
            lazyTrainingRef.current = data.trainingData ?? '';
          } catch {
            lazyTrainingRef.current = '';
          }
        }
        kb = lazyTrainingRef.current || undefined;
      }
      connect({ shopId, shopName, systemPrompt, greetingMessage, language, voice, aiModel, trainingData: kb, collectFields, category });
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Pulsing ring scale based on input level (0-1)
  const pulseScale = state === 'connected' ? 1 + inputLevel * 0.4 : 1;

  // ponytail: live chat page has its own send button; floating call/chat buttons would overlap it
  if (pathname?.startsWith('/livechat')) return null;

  return (
    <>
      {/* ── Call Panel ────────────────────────────────────────────────────── */}
      {showPanel && (
        <div className={`${inline ? 'relative' : 'fixed bottom-24 right-4 md:bottom-8 md:right-6'} z-50 w-80 rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden flex flex-col`} style={{ maxHeight: 480 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2.5">
              {avatar ? (
                <img src={avatar} alt={shopName} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${themeColor}20`, border: `1px solid ${themeColor}40` }}>
                  <Mic size={14} style={{ color: themeColor }} />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{shopName}</p>
                <p className="text-xs text-gray-400">
                  {tab === 'voice'
                    ? (state === 'connecting' ? 'Connecting...' : state === 'connected' ? formatDuration(duration) : state === 'ending' ? 'Ending...' : state === 'ended' ? 'Call ended' : state === 'error' ? 'Connection failed' : 'AI Assistant')
                    : 'AI Assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Tab toggle — only if both modes enabled */}
              {enableVoice && enableChat && (
                <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-0.5 mr-1">
                  <button onClick={() => setTab('voice')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={tab === 'voice' ? { background: themeColor, color: '#fff' } : { color: '#6b7280' }}>
                    <Mic size={11} /> Voice
                  </button>
                  <button onClick={() => setTab('chat')}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={tab === 'chat' ? { background: themeColor, color: '#fff' } : { color: '#6b7280' }}>
                    <MessageSquare size={11} /> Chat
                  </button>
                </div>
              )}
              {!isActive && (
                <button onClick={() => setShowPanel(false)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* ── Voice tab ── */}
          {tab === 'voice' && (
            <>
              <div className="h-48 overflow-y-auto px-3 py-3 flex flex-col-reverse gap-2">
                {state === 'connecting' && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: themeColor, animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: themeColor, animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: themeColor, animationDelay: '300ms' }} />
                  </div>
                )}
                {transcript.filter(m => m.role === 'assistant').length === 0 && state === 'connected' && (
                  <p className="text-xs text-gray-500 text-center py-4">{greetingMessage ?? 'Hi! How can I help you today?'}</p>
                )}
                {[...transcript].filter(m => m.role === 'assistant').reverse().map(msg => (
                  <p key={msg.id} className={`text-xs leading-relaxed text-gray-100 ${!msg.final ? 'opacity-60' : ''}`}>
                    {msg.text || '…'}
                  </p>
                ))}
                {!isActive && !isEnded && (
                  <p className="text-xs text-gray-500 text-center py-4">{greetingMessage ?? 'Tap the mic button to start a voice call'}</p>
                )}
              </div>

              {isActive && (
                <div className="flex items-center justify-center gap-4 px-4 py-4 border-t border-gray-800 shrink-0">
                  <button onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button onClick={disconnect}
                    className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95 shadow-lg shadow-red-500/30">
                    <PhoneOff size={22} />
                  </button>
                </div>
              )}

              {!isActive && !isEnded && (
                <div className="flex justify-center px-4 py-4 border-t border-gray-800 shrink-0">
                  <button onClick={handleCallButton}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all active:scale-95"
                    style={{ background: themeColor }}>
                    <Phone size={16} /> Start Call
                  </button>
                </div>
              )}

              {isEnded && (
                <div className="px-4 py-4 border-t border-gray-800 text-center shrink-0">
                  <p className="text-xs text-gray-400 mb-3">
                    {state === 'error' ? 'Could not connect.' : `Call ended · ${formatDuration(duration)}`}
                  </p>
                  <button onClick={() => { reset(); setShowPanel(false); }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                    Close
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Chat tab ── */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ minHeight: 180 }}>
                {chatMessages.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-6">{greetingMessage ?? 'Hi! Type a message to start chatting.'}</p>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                      style={msg.role === 'user'
                        ? { background: themeColor, color: '#fff', borderBottomRightRadius: 4 }
                        : { background: '#1f2937', color: msg.pending ? '#6b7280' : '#e5e7eb', border: '1px solid #374151', borderBottomLeftRadius: 4 }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="px-3 py-3 border-t border-gray-800 shrink-0">
                <form onSubmit={e => { e.preventDefault(); sendChat(); }} className="flex items-center gap-2">
                  <input
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                    onFocus={e => e.target.style.borderColor = themeColor + '80'}
                    onBlur={e => e.target.style.borderColor = '#374151'}
                  />
                  <button type="submit" disabled={!chatInput.trim() || chatLoading}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: themeColor }}>
                    <Send size={13} className="text-white" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating Bubbles ─────────────────────────────────────────────── */}
      {!inline && (
        <div className={`fixed ${isActive ? 'bottom-24 right-4 md:bottom-8 md:right-6' : 'bottom-20 right-4 md:bottom-6 md:right-6'} z-40 flex items-center gap-2.5`}>
          {/* Pulse ring around the active voice bubble */}
          {state === 'connected' && (
            <div
              className="absolute rounded-full transition-transform duration-75 opacity-30 pointer-events-none"
              style={{
                width: 48,
                height: 48,
                right: 0,
                transform: `scale(${pulseScale})`,
                background: themeColor,
              }}
            />
          )}

          {/* Chat bubble — only when both modes enabled and not in an active call */}
          {!isActive && enableVoice && enableChat && (
            <button
              onClick={() => { setTab('chat'); setShowPanel(true); }}
              className="relative w-12 h-12 rounded-full flex items-center justify-center text-white transition-all active:scale-95 hover:scale-110"
              style={{
                background: '#374151',
                boxShadow: '0 4px 16px rgba(55,65,81,0.5)',
              }}
              aria-label="Open chat"
            >
              <MessageSquare size={20} />
            </button>
          )}

          {/* Voice/Primary bubble */}
          <button
            onClick={isActive ? handleCallButton : enableVoice ? handleCallButton : () => { setTab('chat'); setShowPanel(o => !o); }}
            className="relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all active:scale-95 hover:scale-110 overflow-hidden"
            style={{
              background: isActive ? '#ef4444' : themeColor,
              boxShadow: `0 8px 32px ${isActive ? '#ef444440' : themeColor + '40'}`,
            }}
            aria-label={isActive ? 'End call' : enableVoice ? 'Start voice call' : 'Open chat'}
          >
            {isActive ? (
              <PhoneOff size={22} />
            ) : avatar ? (
              <img src={avatar} alt="Shop" className="w-full h-full object-cover rounded-full" />
            ) : enableChat && !enableVoice ? (
              <MessageSquare size={22} />
            ) : (
              <Phone size={22} />
            )}
          </button>
        </div>
      )}
    </>
  );
}
