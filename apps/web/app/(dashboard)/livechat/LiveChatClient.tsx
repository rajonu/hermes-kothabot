'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Pause, Play, Facebook, Phone, ArrowLeft } from 'lucide-react';

interface Conversation {
  id: string;
  shop_id: string;
  platform: 'facebook' | 'whatsapp';
  customer_external_id: string;
  customer_name: string | null;
  is_ai_paused: boolean;
  paused_at: string | null;
  pause_reason: string | null;
  last_message_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: 'in' | 'out';
  sender: 'customer' | 'ai' | 'human';
  body: string | null;
  external_message_id: string | null;
  created_at: string;
}

const PLATFORM_BADGE: Record<string, { label: string; cls: string }> = {
  facebook: { label: 'Messenger', cls: 'bg-blue-500/10 text-blue-400' },
  whatsapp: { label: 'WhatsApp', cls: 'bg-green-500/10 text-green-400' },
};

export function LiveChatClient({ shopId }: { shopId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pauseToggling, setPauseToggling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  const selected = conversations.find(c => c.id === selectedId) ?? null;

  const loadConversations = useCallback(async (archived: boolean) => {
    setLoadingConvos(true);
    try {
      const res = await fetch(`/api/livechat/conversations?limit=50&archived=${archived}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/livechat/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { setSelectedId(null); loadConversations(showArchived); }, [loadConversations, showArchived]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Realtime: conversations + messages + phone-takeover broadcast ───────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`livechat:${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'omni_conversations', filter: `shop_id=eq.${shopId}` },
        (payload) => {
          const row = payload.new as Conversation | undefined;
          if (!row) return;
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === row.id);
            const next = idx >= 0
              ? prev.map((c, i) => (i === idx ? row : c))
              : [row, ...prev];
            return [...next].sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
        (payload) => {
          const row = payload.new as Message;
          // conversation_messages has no shop_id column — filter client-side
          // against the conversation ids we currently know belong to this shop.
          const knownIds = new Set(conversationsRef.current.map(c => c.id));
          if (!knownIds.has(row.conversation_id)) return;
          if (row.conversation_id === selectedId) {
            setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]));
          }
        }
      )
      .on('broadcast', { event: 'ai_paused_by_phone' }, ({ payload }) => {
        setToast(`Owner took over a conversation from their phone (${payload?.jid ?? 'WhatsApp'}).`);
        loadConversations(showArchived);
        setTimeout(() => setToast(null), 6000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, selectedId, showArchived]);

  async function sendReply() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/livechat/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) setMessages(prev => [...prev, data.message]);
        setDraft('');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  }

  async function togglePause() {
    if (!selected) return;
    setPauseToggling(true);
    const action = selected.is_ai_paused ? 'resume' : 'pause';
    try {
      const res = await fetch(`/api/livechat/${selected.id}/${action}`, { method: 'POST' });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === selected.id
          ? { ...c, is_ai_paused: !selected.is_ai_paused, pause_reason: !selected.is_ai_paused ? 'dashboard' : null }
          : c));
      }
    } finally {
      setPauseToggling(false);
    }
  }

  return (
    <div className="flex h-full gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-amber-900/90 border border-amber-600 text-amber-200 text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm">
          📱 {toast}
        </div>
      )}

      {/* Conversation list — hidden on mobile once a thread is open */}
      <div className={`w-full sm:w-80 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl flex-col overflow-hidden ${selectedId ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-3 border-b border-gray-800 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Conversations</h2>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setShowArchived(false)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${!showArchived ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Active
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${showArchived ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Archived
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <div className="p-4 text-xs text-gray-500">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-xs text-gray-500">{showArchived ? 'No archived conversations.' : 'No conversations yet.'}</div>
          ) : (
            conversations.map(c => {
              const badge = PLATFORM_BADGE[c.platform];
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-800/60 hover:bg-gray-800/50 transition-colors ${active ? 'bg-gray-800' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {c.customer_name || c.customer_external_id}
                    </span>
                    {c.is_ai_paused && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-700 text-white flex-shrink-0">PAUSED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                      {c.platform === 'facebook' ? <Facebook className="inline w-2.5 h-2.5 mr-1" /> : <Phone className="inline w-2.5 h-2.5 mr-1" />}
                      {badge.label}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {new Date(c.last_message_at).toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Thread view — hidden on mobile until a conversation is selected */}
      <div className={`flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex-col overflow-hidden min-w-0 ${selectedId ? 'flex' : 'hidden sm:flex'}`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Select a conversation to view the thread.
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-gray-800 flex items-center gap-2">
              <button
                onClick={() => setSelectedId(null)}
                className="sm:hidden flex-shrink-0 p-1.5 -ml-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {selected.customer_name || selected.customer_external_id}
                </p>
                <p className="text-xs text-gray-500">
                  {PLATFORM_BADGE[selected.platform].label} · {selected.customer_external_id}
                </p>
              </div>
              <button
                onClick={togglePause}
                disabled={pauseToggling}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-50 ${
                  selected.is_ai_paused
                    ? 'bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border-emerald-800/50'
                    : 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border-amber-800/50'
                }`}
              >
                {selected.is_ai_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {selected.is_ai_paused ? 'Resume AI' : 'Pause AI'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <p className="text-xs text-gray-500">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-gray-500">No messages yet.</p>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender === 'customer'
                          ? 'bg-gray-800 text-gray-100'
                          : m.sender === 'human'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-900/60 text-emerald-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 text-[10px] opacity-60">
                        {m.sender === 'ai' ? 'AI' : m.sender === 'human' ? 'You' : ''} · {new Date(m.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-800 flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !sending) sendReply(); }}
                placeholder="Type a reply…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
              />
              <button
                onClick={sendReply}
                disabled={sending || !draft.trim()}
                className="flex-shrink-0 p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
