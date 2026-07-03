'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ImagePlus, X } from 'lucide-react';

interface Props { shopId: string }

export function NewTicketForm({ shopId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject]         = useState('');
  const [message, setMessage]         = useState('');
  const [screenshot, setScreenshot]   = useState<string | null>(null); // base64 data URL
  const [screenshotName, setScName]   = useState('');
  const [error, setError]             = useState('');
  const [pending, start]              = useTransition();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('Screenshot must be under 3MB.'); return; }
    if (!file.type.startsWith('image/')) { setError('Only image files allowed.'); return; }
    setError('');
    setScName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setScreenshot(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { setError('Subject and message are required.'); return; }
    setError('');
    start(async () => {
      const res = await fetch('/api/support/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          subject: subject.trim(),
          message: message.trim(),
          screenshot: screenshot ?? undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/support/${data.id}`);
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to create ticket');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. Voice widget not loading"
          maxLength={120}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe your issue in detail…"
          rows={4}
          maxLength={2000}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
        />
        <p className="text-right text-[10px] text-gray-600 mt-1">{message.length}/2000</p>
      </div>

      {/* Screenshot upload */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Screenshot <span className="font-normal text-gray-600">(optional)</span></label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        {screenshot ? (
          <div className="relative inline-block">
            <img
              src={screenshot}
              alt="Screenshot preview"
              className="max-h-40 rounded-lg border border-gray-700 object-contain bg-gray-900"
            />
            <button
              type="button"
              onClick={() => { setScreenshot(null); setScName(''); if (fileRef.current) fileRef.current.value = ''; }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-400 transition-colors"
            >
              <X size={12} />
            </button>
            <p className="text-[11px] text-gray-500 mt-1 truncate max-w-[200px]">{screenshotName}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:border-emerald-500 hover:text-emerald-400 text-sm transition-colors"
          >
            <ImagePlus size={15} />
            Attach screenshot
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !subject.trim() || !message.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Submit Ticket</>}
      </button>
    </form>
  );
}
