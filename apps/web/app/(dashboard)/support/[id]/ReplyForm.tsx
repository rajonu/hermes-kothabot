'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ImagePlus, X } from 'lucide-react';

interface Props { ticketId: string }

export function ReplyForm({ ticketId }: Props) {
  const router              = useRouter();
  const fileRef             = useRef<HTMLInputElement>(null);
  const [text, setText]     = useState('');
  const [screenshot, setSc] = useState<string | null>(null);
  const [scName, setScName] = useState('');
  const [error, setError]   = useState('');
  const [pending, start]    = useTransition();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('Screenshot must be under 3MB.'); return; }
    if (!file.type.startsWith('image/')) { setError('Only image files allowed.'); return; }
    setError('');
    setScName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setSc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !screenshot) return;
    setError('');
    start(async () => {
      const res = await fetch('/api/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, message: text.trim(), screenshot: screenshot ?? undefined }),
      });
      if (res.ok) {
        setText('');
        setSc(null); setScName('');
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to send reply');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your reply…"
        rows={3}
        maxLength={2000}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
      />

      {/* Screenshot */}
      <div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {screenshot ? (
          <div className="relative inline-block">
            <img src={screenshot} alt="Screenshot" className="max-h-32 rounded-lg border border-gray-700 object-contain bg-gray-900" />
            <button
              type="button"
              onClick={() => { setSc(null); setScName(''); if (fileRef.current) fileRef.current.value = ''; }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-400"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
          >
            <ImagePlus size={13} /> Attach screenshot
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending || (!text.trim() && !screenshot)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Reply</>}
      </button>
    </form>
  );
}
