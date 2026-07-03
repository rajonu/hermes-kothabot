'use client';

import { useState } from 'react';
import { Loader2, Check, X, Plus } from 'lucide-react';

interface Props { initialIps: string[]; }

export function SipSettingsForm({ initialIps }: Props) {
  const [ips, setIps] = useState<string[]>(initialIps);
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(currentIps: string[]) {
    setSaving(true);
    try {
      await fetch('/api/admin/settings/sip-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips: currentIps }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function addIp() {
    const ip = newIp.trim();
    if (!ip || ips.includes(ip)) return;
    const updated = [...ips, ip];
    setIps(updated);
    setNewIp('');
    handleSave(updated);
  }

  function removeIp(ip: string) {
    if (!confirm(`Are you sure you want to remove the SIP Provider IP: ${ip}?`)) return;
    const updated = ips.filter(i => i !== ip);
    setIps(updated);
    handleSave(updated);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {ips.map((ip) => (
          <div key={ip} className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-4 py-2">
            <span className="text-white font-mono text-sm">{ip}</span>
            <button
              onClick={() => removeIp(ip)}
              className="text-red-400 hover:text-red-300 p-1"
              title="Remove IP"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {ips.length === 0 && (
          <p className="text-xs text-gray-500 py-2">No SIP Provider IPs configured.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newIp}
          onChange={e => setNewIp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addIp()}
          placeholder="e.g. 202.40.176.2"
          className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-600 font-mono"
        />
        <button
          onClick={addIp}
          disabled={!newIp.trim() || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Add IP
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-1 text-emerald-400 text-xs">
          <Check size={14} /> Saved & applied instantly to Asterisk server!
        </div>
      )}
    </div>
  );
}
