'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export function ImportButton({ shopId }: { shopId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg(null);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? [];
        return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').replace(/^"|"$/g, '')]));
      });

      const res = await fetch('/api/orders/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, rows }),
      });
      const json = await res.json();
      setMsg(res.ok ? `Imported ${json.count} record(s)` : (json.error ?? 'Import failed'));
    } catch {
      setMsg('Failed to parse CSV');
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => ref.current?.click()}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
      >
        <Upload size={13} /> <span className="hidden sm:inline">{loading ? 'Importing…' : 'Import'}</span>
      </button>
      <input ref={ref} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      {msg && (
        <div className="absolute top-10 right-0 z-10 text-xs px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 whitespace-nowrap shadow-lg">
          {msg}
        </div>
      )}
    </div>
  );
}
