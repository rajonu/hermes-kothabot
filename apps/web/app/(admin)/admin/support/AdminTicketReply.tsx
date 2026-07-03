'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, CheckCircle, ImagePlus, X } from 'lucide-react';

interface Msg { role: 'client' | 'admin'; text: string; created_at: string; screenshot?: string }
interface Props { ticket: any; shopName: string }

export function AdminTicketReply({ ticket, shopName }: Props) {
  const router            = useRouter();
  const fileRef           = useRef<HTMLInputElement>(null);
  const [reply, setReply] = useState('');
  const [screenshot, setSc] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, start]  = useTransition();
  const msgEnd = useRef<HTMLDivElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('Image must be under 3MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => setSc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
    // Mark as read by admin
    fetch('/api/admin/support/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
  }, [ticket.id]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() && !screenshot) return;
    setError('');
    start(async () => {
      const customerEmail = ticket.customer_email || 'customer@example.com';
      const res = await fetch('/api/admin/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          message: reply.trim(),
          screenshot: screenshot ?? undefined,
          customerEmail,
          customerName: 'Customer',
          shopName,
          subject: ticket.subject,
        }),
      });
      if (res.ok) {
        setReply('');
        setSc(null);
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to send');
      }
    });
  };

  const handleResolve = () => {
    start(async () => {
      await fetch('/api/admin/support/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id }),
      });
      router.refresh();
    });
  };

  const messages: Msg[] = ticket.messages ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900 shrink-0">
        <div>
          <p className="text-sm font-semibold text-white">{ticket.subject}</p>
          <p className="text-xs text-gray-500 mt-0.5">{shopName} · #{ticket.id.slice(0, 8)}</p>
        </div>
        {ticket.status !== 'resolved' && (
          <button
            onClick={handleResolve}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
          >
            <CheckCircle size={12} /> Mark Resolved
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.map((msg, i) => {
          const isAdmin = msg.role === 'admin';
          return (
            <div key={i} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isAdmin
                  ? 'bg-emerald-600/20 border border-emerald-600/30 rounded-tr-sm'
                  : 'bg-gray-800 border border-gray-700 rounded-tl-sm'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-gray-400">
                    {isAdmin ? '🛡️ Support Team' : '👤 ' + shopName}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(msg.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.text && <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                {msg.screenshot && (
                  <a href={msg.screenshot} target="_blank" rel="noopener noreferrer" className="block mt-2">
                    <img
                      src={msg.screenshot}
                      alt="Screenshot"
                      className="max-h-44 rounded-lg border border-gray-600 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                    />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        <div ref={msgEnd} />
      </div>

      {/* Reply box */}
      {ticket.status !== 'resolved' ? (
        <form onSubmit={handleSend} className="p-4 border-t border-gray-800 bg-gray-900 shrink-0 space-y-2">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          {screenshot && (
            <div className="relative inline-block">
              <img src={screenshot} alt="Preview" className="max-h-24 rounded-lg border border-gray-700 object-contain" />
              <button type="button" onClick={() => { setSc(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-400">
                <X size={10} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
              placeholder="Type reply… (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
            <div className="flex flex-col gap-1.5 self-end">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors">
                <ImagePlus size={15} />
              </button>
              <button
                type="submit"
                disabled={pending || (!reply.trim() && !screenshot)}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
          <p className="text-center text-sm text-emerald-400">✓ Ticket resolved</p>
        </div>
      )}
    </div>
  );
}
