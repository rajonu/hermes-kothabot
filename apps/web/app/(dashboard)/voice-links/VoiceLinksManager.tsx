'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, RefreshCw, ExternalLink, Radio } from 'lucide-react';

interface VoiceLinksManagerProps {
  shopId: string;
  shopName: string;
  initialSlug: string;
  initialEnabled: boolean;
  initialTitle: string;
  initialDescription: string;
  customersLabel?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 50;
}

const BASE_URL = process.env.NEXT_PUBLIC_VOICE_LINK_URL ?? 'https://call.kothabot.ai.bd';

export function VoiceLinksManager({
  shopId,
  shopName,
  initialSlug,
  initialEnabled,
  initialTitle,
  initialDescription,
  customersLabel = 'Customers',
}: VoiceLinksManagerProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [slugError, setSlugError] = useState('');
  const [copied, setCopied] = useState(false);

  const [stats, setStats] = useState<{ visits: number; voiceStarts: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const publicUrl = slug ? `${BASE_URL}/${slug}` : '';
  const qrUrl = slug
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}&bgcolor=1f2937&color=10b981&format=png`
    : null;

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    fetch('/api/voice-links/stats')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  function handleSlugChange(val: string) {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    if (cleaned && !isValidSlug(cleaned)) {
      setSlugError('3–50 characters, lowercase letters, numbers, hyphens. Cannot start or end with a hyphen.');
    } else {
      setSlugError('');
    }
  }

  function autoGenerateSlug() {
    const generated = slugify(shopName);
    setSlug(generated);
    setSlugError('');
  }

  async function handleCopy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  async function handleSave() {
    if (!isValidSlug(slug)) {
      setSlugError('Please fix the slug before saving.');
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch('/api/voice-links/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, enabled, title, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveMsg({ type: 'error', text: data.error ?? 'Failed to save' });
      } else {
        setSaveMsg({ type: 'success', text: 'Saved successfully!' });
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Slug Editor */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Your Voice Link</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {customersLabel} visit this link to talk to your AI assistant by voice.
          </p>
        </div>
        <div className="p-5 space-y-4">

          {/* Slug input */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">
              Link slug
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center rounded-lg border border-gray-700 bg-gray-800 overflow-hidden focus-within:border-emerald-500 transition-colors">
                <span className="pl-3 text-gray-500 text-sm whitespace-nowrap select-none hidden sm:inline">
                  {BASE_URL.replace(/^https?:\/\//, '')}/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="your-shop-name"
                  className="flex-1 bg-transparent text-white text-sm px-3 py-2.5 outline-none placeholder-gray-600"
                />
              </div>
              <button
                onClick={autoGenerateSlug}
                title="Auto-generate from shop name"
                className="px-3 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            {slugError && (
              <p className="mt-1.5 text-xs text-red-400">{slugError}</p>
            )}
          </div>

          {/* Public URL Preview */}
          {slug && !slugError && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5">
              <span className="flex-1 text-sm text-emerald-400 font-mono truncate">{publicUrl}</span>
              <button
                onClick={handleCopy}
                title="Copy link"
                className="text-gray-400 hover:text-white transition-colors shrink-0"
              >
                {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open link"
                className="text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <ExternalLink size={15} />
              </a>
            </div>
          )}

          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Public access</p>
              <p className="text-xs text-gray-400">Allow customers to visit this voice link</p>
            </div>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-emerald-600' : 'bg-gray-600'
              }`}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Page Title & Description */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Page Content</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Shown to visitors on your public voice page.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">
              Page title <span className="text-gray-600">(optional — defaults to shop name)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={shopName}
              maxLength={120}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 text-white text-sm px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors placeholder-gray-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Talk to our AI assistant"
              maxLength={300}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 text-white text-sm px-3 py-2.5 outline-none focus:border-emerald-500 transition-colors placeholder-gray-600 resize-none"
            />
          </div>
        </div>
      </div>

      {/* QR Code */}
      {slug && !slugError && qrUrl && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">QR Code</h2>
            <p className="text-xs text-gray-400 mt-0.5">Print or share this QR code for instant access.</p>
          </div>
          <div className="p-5 flex items-center gap-6">
            <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-800 p-2 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR Code"
                width={120}
                height={120}
                className="block"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-300">Scan to open your voice page</p>
              <p className="text-xs text-gray-500 font-mono break-all">{publicUrl}</p>
              <a
                href={qrUrl}
                download={`${slug}-qr.png`}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Download QR
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Analytics mini-card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Analytics (Last 30 days)</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 text-center">
            {statsLoading ? (
              <div className="text-2xl font-bold text-gray-600">—</div>
            ) : (
              <div className="text-2xl font-bold text-white">{stats?.visits ?? 0}</div>
            )}
            <p className="text-xs text-gray-400 mt-1">Page Visits</p>
          </div>
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 text-center">
            {statsLoading ? (
              <div className="text-2xl font-bold text-gray-600">—</div>
            ) : (
              <div className="text-2xl font-bold text-emerald-400">{stats?.voiceStarts ?? 0}</div>
            )}
            <p className="text-xs text-gray-400 mt-1">Voice Calls Started</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !!slugError || !slug}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {saveMsg && (
          <span
            className={`text-sm font-medium ${
              saveMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {saveMsg.text}
          </span>
        )}
      </div>
    </div>
  );
}
