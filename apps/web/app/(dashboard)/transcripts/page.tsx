'use client';

import { useEffect, useState, Suspense } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Phone, Calendar, Clock, Archive, X } from 'lucide-react';
import { getDocsCategory } from '@/lib/category-nav';
import { useSearchParams } from 'next/navigation';

interface Transcript {
  id: string;
  created_at: string;
  duration_s: number;
  transcript: Array<{ role: 'user' | 'assistant'; text: string; timestamp: number }>;
  order_linked: boolean;
  end_reason: string;
  off_topic_count: number;
  source?: 'widget' | 'voice_link' | 'phone' | null;
  caller_did?: string | null;
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  phone:      { label: '📞 IP Phone',   cls: 'bg-blue-500/10 text-blue-400' },
  voice_link: { label: '🔗 Voice Link', cls: 'bg-purple-500/10 text-purple-400' },
  widget:     { label: '🌐 Widget',     cls: 'bg-gray-500/10 text-gray-300' },
};

function TranscriptsList() {
  const [sessions, setSessions] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Transcript | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState<string>('other');
  const limit = 20;
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('session');

  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      if (sessionIdParam) {
        const singleRes = await fetch(`/api/voice/transcripts?sessionId=${sessionIdParam}`);
        if (singleRes.ok) {
          const singleData = await singleRes.json();
          if (singleData.session) {
            setSelectedSession(singleData.session);
          }
        }
      }

      const res = await fetch(`/api/voice/transcripts?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
      if (data.category) {
        setCategory(data.category);
      }
    } catch (err) {
      console.error('Failed to fetch transcripts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscripts();
  }, [offset]);

  const isEmpty = total === 0;
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  };
  const getExpiryDate = (session: Transcript) => {
    if (session.order_linked) return 'Permanent (Order)';
    // 7 days from creation
    const d = new Date(session.created_at);
    d.setDate(d.getDate() + 7);
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  const endReasonLabels: Record<string, string> = {
    completed: '✓ Completed',
    user_requested_end: '⏹ User Ended',
    off_topic_limit: '⚠ Off-Topic',
    time_limit: '⏱ Time Limit',
    silence_timeout: 'Silence',
    system_end: 'System',
    ws_disconnected: 'Dropped',
  };

  return (
    <div>
      <PageHeader
        title="Call Transcripts"
        description="View complete transcripts from your voice calls. Order-linked transcripts are kept permanently."
        docsUrl={`https://kothabot.ai.bd/docs/transcripts?category=${getDocsCategory(category)}`}
      />

      {isEmpty ? (
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-16 text-center">
          <Phone size={32} className="mx-auto mb-3 text-gray-700" />
          <p className="text-white font-semibold">No transcripts yet</p>
          <p className="text-sm text-gray-400 mt-1">Your call transcripts will appear here once customers start using the voice widget or call your connected IP phone.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-700">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="w-full px-5 py-4 hover:bg-gray-700 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">
                          {formatDate(session.created_at)} at {formatTime(session.created_at)}
                        </p>
                        {(() => {
                          const src = session.source ?? 'widget';
                          const badge = SOURCE_BADGE[src] ?? SOURCE_BADGE.widget;
                          return (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                              {badge.label}
                              {src === 'phone' && session.caller_did ? ` · ${session.caller_did}` : ''}
                            </span>
                          );
                        })()}
                        {session.order_linked && (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                            Order
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono mb-1">{session.id.slice(0, 12)}…</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {Math.floor(session.duration_s / 60)}m {session.duration_s % 60}s
                        </span>
                        <span className="flex items-center gap-1">
                          <Archive size={12} />
                          Expires: {getExpiryDate(session)}
                        </span>
                        {(session.off_topic_count ?? 0) > 0 && (
                          <span className="text-red-400">{session.off_topic_count} off-topic</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-medium ${
                        session.end_reason === 'completed' || session.end_reason === 'user_requested_end'
                          ? 'text-emerald-500'
                          : session.end_reason === 'off_topic_limit'
                          ? 'text-red-500'
                          : 'text-amber-500'
                      }`}>
                        {endReasonLabels[session.end_reason] || session.end_reason}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-500">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
              >
                ← Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Viewer Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <p className="text-sm font-semibold text-white">
                  {formatDate(selectedSession.created_at)} at {formatTime(selectedSession.created_at)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.floor(selectedSession.duration_s / 60)}m {selectedSession.duration_s % 60}s
                  {selectedSession.order_linked && ' · Permanently stored'}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Transcript */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {selectedSession.transcript?.length > 0 ? (
                selectedSession.transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                        msg.role === 'assistant'
                          ? 'bg-gray-800 text-gray-100'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className="text-xs mt-1 opacity-60">
                        {new Date(msg.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 text-xs">No transcript available</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-800 p-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TranscriptsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-gray-400">Loading transcripts...</p>
      </div>
    }>
      <TranscriptsList />
    </Suspense>
  );
}
