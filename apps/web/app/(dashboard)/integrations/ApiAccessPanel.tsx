'use client';

import { useState, useEffect } from 'react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  type: 'test' | 'live';
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
  raw_key?: string;
}

interface UsageStats {
  total_requests: number;
  error_requests: number;
  success_rate: number;
  avg_duration_ms: number;
  by_endpoint: Record<string, number>;
}

export function ApiAccessPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'start' | 'keys' | 'webhooks' | 'docs'>('start');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [keysRes, usageRes] = await Promise.all([
      fetch('/api/api-keys'),
      fetch('/api/api-keys/usage'),
    ]);
    if (keysRes.ok) setKeys((await keysRes.json()).keys ?? []);
    if (usageRes.ok) setUsage(await usageRes.json());
    setLoading(false);
  }

  const MAX_KEYS = 4;
  const activeCount = keys.filter(k => k.is_active).length;
  const atLimit = activeCount >= MAX_KEYS;

  async function generate(type: 'test' | 'live') {
    setGenerating(true);
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (data.key?.raw_key) {
      setNewKey(data.key);
      setKeys(prev => [data.key, ...prev]);
    } else if (data.error) {
      alert(data.error);
    }
    setGenerating(false);
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? All integrations using it will stop working.')) return;
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  }

  async function deleteKey(id: string) {
    if (!confirm('Permanently delete this revoked key? This cannot be undone.')) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: 'PATCH' });
    if (res.ok) setKeys(prev => prev.filter(k => k.id !== id));
  }

  async function regenerate(id: string) {
    if (!confirm('Regenerate? The old key will be disabled immediately.')) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.key?.raw_key) {
      setNewKey(data.key);
      await loadData();
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="text-gray-400 text-sm">Loading API keys…</div>;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit flex-wrap">
        {(['start', 'keys', 'webhooks', 'docs'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t === 'start' ? '🚀 Get Started' : t === 'keys' ? 'API Keys' : t === 'webhooks' ? 'Webhooks' : 'API Docs'}
          </button>
        ))}
      </div>

      {tab === 'start' && <GettingStartedPanel onGoToKeys={() => setTab('keys')} onGoToDocs={() => setTab('docs')} />}

      {tab === 'keys' && (
        <div className="space-y-5">
          {/* Usage Stats */}
          {usage && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Requests (30d)', value: usage.total_requests.toLocaleString() },
                { label: 'Success Rate', value: `${usage.success_rate}%` },
                { label: 'Errors', value: usage.error_requests.toLocaleString() },
                { label: 'Avg Response', value: `${usage.avg_duration_ms}ms` },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className="text-lg font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* New key revealed */}
          {newKey?.raw_key && (
            <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-amber-400 text-sm font-semibold">⚠ Copy your API key now</span>
              </div>
              <p className="text-gray-400 text-xs mb-3">This key will never be shown again.</p>
              <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400 break-all">
                <span className="flex-1">{newKey.raw_key}</span>
                <button
                  onClick={() => copy(newKey.raw_key!, 'new-key')}
                  className="text-gray-400 hover:text-white flex-shrink-0"
                >
                  {copied === 'new-key' ? '✓' : '⎘'}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 text-xs text-gray-500 hover:text-white"
              >
                I've saved it — dismiss
              </button>
            </div>
          )}

          {/* Generate buttons + limit indicator */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => generate('live')}
              disabled={generating || atLimit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating…' : '+ Live Key'}
            </button>
            <button
              onClick={() => generate('test')}
              disabled={generating || atLimit}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? '…' : '+ Test Key'}
            </button>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              atLimit ? 'bg-red-900/40 text-red-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {activeCount} / {MAX_KEYS} active keys
            </span>
            {atLimit && (
              <span className="text-xs text-red-400">Revoke a key to generate a new one.</span>
            )}
          </div>

          {/* Key list */}
          <div className="space-y-2">
            {keys.length === 0 && (
              <p className="text-gray-500 text-sm">No API keys yet. Generate one above to get started.</p>
            )}
            {keys.map(k => (
              <div
                key={k.id}
                className={`flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 border ${
                  k.is_active ? 'border-gray-800' : 'border-red-900/40 opacity-60'
                }`}
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  k.type === 'live' ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-300'
                }`}>
                  {k.type.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400 font-semibold flex-shrink-0">{k.name}</span>
                <span className="font-mono text-xs text-gray-400 bg-gray-950 px-2 py-1 rounded flex-1 truncate">
                  {k.key_prefix}••••••••••••••••••••••••••••••••
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{(k.request_count ?? 0).toLocaleString()} req</span>
                  {k.last_used_at && (
                    <span>· {new Date(k.last_used_at).toLocaleDateString()}</span>
                  )}
                </div>
                {k.is_active ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => copy(k.key_prefix + '…', k.id)}
                      className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800"
                      title="Copy prefix"
                    >
                      {copied === k.id ? '✓' : '⎘'}
                    </button>
                    <button
                      onClick={() => regenerate(k.id)}
                      className="text-xs text-gray-500 hover:text-amber-400 px-2 py-1 rounded hover:bg-gray-800"
                    >
                      ↺ Regenerate
                    </button>
                    <button
                      onClick={() => revokeKey(k.id)}
                      className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800"
                    >
                      Revoke
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-red-400 font-semibold px-2 py-0.5 bg-red-900/30 rounded-full">REVOKED</span>
                    <button
                      onClick={() => deleteKey(k.id)}
                      className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                      title="Permanently delete this key"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'webhooks' && <WebhooksPanel />}
      {tab === 'docs' && <ApiDocsPanel />}
    </div>
  );
}

/* ─── Getting Started Panel ──────────────────────────────────────── */

function GettingStartedPanel({ onGoToKeys, onGoToDocs }: { onGoToKeys: () => void; onGoToDocs: () => void }) {
  const BASE = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd'}/api/v1`;

  const steps = [
    {
      num: '1',
      title: 'Generate an API Key',
      color: 'emerald',
      desc: 'Go to the API Keys tab and click "Generate Live Key". Copy the key immediately — it is only shown once.',
      action: { label: 'Go to API Keys →', fn: onGoToKeys },
      code: null,
    },
    {
      num: '2',
      title: 'Add the key to every request',
      color: 'blue',
      desc: 'Include this HTTP header in all your API calls:',
      action: null,
      code: `Authorization: Bearer kb_live_YOUR_KEY_HERE`,
    },
    {
      num: '3',
      title: 'Make your first request',
      color: 'purple',
      desc: 'Test that everything is working — this returns your shop info:',
      action: null,
      code: `curl ${BASE}/me \\
  -H "Authorization: Bearer kb_live_YOUR_KEY_HERE"`,
    },
    {
      num: '4',
      title: 'Start creating data',
      color: 'amber',
      desc: 'Create a customer, then an order. Your KothaBot dashboard will show them instantly.',
      action: null,
      code: `# Create a customer
curl -X POST ${BASE}/customers \\
  -H "Authorization: Bearer kb_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Rahim Uddin","phone":"01711000000"}'

# Create an order
curl -X POST ${BASE}/orders \\
  -H "Authorization: Bearer kb_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"customer_id":"<id from above>","items":[{"name":"Biriyani","quantity":2}],"total_amount":400}'`,
    },
  ];

  const integrations = [
    { name: 'WhatsApp', icon: '📱', desc: 'Forward messages → POST /ai/chat → reply back' },
    { name: 'Messenger', icon: '💬', desc: 'Same pattern: message in → AI out → send reply' },
    { name: 'Telegram', icon: '✈️', desc: 'Telegram bot webhook → KothaBot AI → respond' },
    { name: 'WordPress / Amelia', icon: '🌐', desc: 'Booking confirmed → POST /appointments → synced' },
    { name: 'Zapier / Make.com', icon: '⚡', desc: 'Trigger: new form → Action: POST /customers or /orders' },
    { name: 'CRM Systems', icon: '🗂️', desc: 'Sync contacts via GET /customers, push updates via PUT' },
    { name: 'Mobile Apps', icon: '📲', desc: 'Use live key server-side; test key for development' },
    { name: 'Google Sheets', icon: '📊', desc: 'Apps Script → fetch /orders → write to sheet' },
  ];

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/20 border border-emerald-700/30 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-white mb-1">KothaBot Public API</h3>
        <p className="text-sm text-gray-300 mb-3">
          Connect any third-party system to your KothaBot shop — WhatsApp, Zapier, CRMs, mobile apps, and more.
          All data stays in your account. Every request is isolated to your shop only.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {['REST API', 'JSON responses', 'Paginated lists', 'Rate limited: 60 req/min', 'HTTPS only', 'Bearer token auth'].map(tag => (
            <span key={tag} className="bg-gray-900 border border-gray-700 rounded-full px-3 py-1 text-gray-400">{tag}</span>
          ))}
        </div>
      </div>

      {/* Step by step */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-4">Setup in 4 steps</h4>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5 ${
                s.color === 'emerald' ? 'bg-emerald-700 text-white' :
                s.color === 'blue'    ? 'bg-blue-700 text-white' :
                s.color === 'purple'  ? 'bg-purple-700 text-white' :
                'bg-amber-700 text-white'
              }`}>{s.num}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">{s.title}</p>
                <p className="text-xs text-gray-400 mb-2">{s.desc}</p>
                {s.code && (
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all">{s.code}</pre>
                )}
                {s.action && (
                  <button onClick={s.action.fn} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                    {s.action.label}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What you get back */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-3">What the API returns</h4>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {[
            { endpoint: 'GET /me', returns: 'Your shop name, category, language setting' },
            { endpoint: 'GET /customers', returns: 'Paginated list with name, phone, address, lifetime value' },
            { endpoint: 'GET /orders', returns: 'All orders — filter by status=pending, type=appointment' },
            { endpoint: 'GET /appointments', returns: 'Only appointment-type orders (clinic, salon, etc.)' },
            { endpoint: 'GET /products', returns: 'Your active products/services with prices' },
            { endpoint: 'POST /ai/chat', returns: 'AI reply using your full shop context + training data' },
            { endpoint: 'POST /ai/order', returns: 'AI extracts + auto-saves order from free text' },
            { endpoint: 'GET /webhooks', returns: 'Your registered webhook endpoints' },
          ].map(r => (
            <div key={r.endpoint} className="flex gap-2">
              <code className="text-blue-400 flex-shrink-0">{r.endpoint}</code>
              <span className="text-gray-500">→ {r.returns}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Popular integrations</h4>
        <div className="grid sm:grid-cols-2 gap-2">
          {integrations.map(i => (
            <div key={i.name} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
              <span className="text-xl flex-shrink-0">{i.icon}</span>
              <div>
                <p className="text-xs font-semibold text-white">{i.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{i.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-3">Security rules</h4>
        <ul className="space-y-2 text-xs text-gray-400">
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Your API key can only access YOUR shop data — never another client's.</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Keys are stored as SHA-256 hashes. KothaBot cannot see your raw key.</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Use <strong className="text-white">Test key</strong> during development. Switch to <strong className="text-white">Live key</strong> for production.</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Rate limit: 60 requests/minute. Response headers tell you how many you have left.</li>
          <li className="flex gap-2"><span className="text-emerald-400">✓</span> Webhook payloads are signed with HMAC-SHA256 — always verify the signature.</li>
          <li className="flex gap-2"><span className="text-amber-400">⚠</span> Never put your Live key in browser/frontend JavaScript. Only use it server-side.</li>
        </ul>
      </div>

      {/* CTA row */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={onGoToKeys} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl">
          Generate my first API key →
        </button>
        <button onClick={onGoToDocs} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl border border-gray-700">
          View full API reference →
        </button>
      </div>

    </div>
  );
}

/* ─── Webhooks Panel ─────────────────────────────────────────────── */

interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  useEffect(() => { loadWebhooks(); }, []);

  async function loadWebhooks() {
    const res = await fetch('/api/api-keys/webhooks');
    if (res.ok) setWebhooks((await res.json()).webhooks ?? []);
  }

  async function addWebhook() {
    if (!url.trim()) return;
    setSaving(true);
    const res = await fetch('/api/api-keys/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json();
    if (data.webhook?.secret) {
      setNewSecret(data.webhook.secret);
      setUrl('');
      loadWebhooks();
    } else {
      alert(data.error ?? 'Failed to create webhook');
    }
    setSaving(false);
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return;
    await fetch(`/api/api-keys/webhooks/${id}`, { method: 'DELETE' });
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        KothaBot will POST to your URL when events happen. Verify the{' '}
        <code className="text-emerald-400">X-KothaBot-Signature</code> header using HMAC-SHA256.
      </p>

      {newSecret && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4">
          <p className="text-amber-400 text-sm font-semibold mb-1">⚠ Save your webhook secret</p>
          <p className="text-gray-400 text-xs mb-2">Used to verify incoming webhook payloads. Never shown again.</p>
          <code className="block bg-gray-950 rounded p-2 text-xs text-emerald-400 break-all">{newSecret}</code>
          <button onClick={() => setNewSecret(null)} className="mt-2 text-xs text-gray-500 hover:text-white">Dismiss</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://your-site.com/webhook"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
        />
        <button
          onClick={addWebhook}
          disabled={saving || !url.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? 'Adding…' : '+ Add Endpoint'}
        </button>
      </div>

      <div className="space-y-2">
        {webhooks.length === 0 && <p className="text-gray-500 text-sm">No webhooks yet.</p>}
        {webhooks.map(w => (
          <div key={w.id} className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{w.url}</p>
              <p className="text-xs text-gray-500 mt-0.5">{w.events.join(', ')}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${w.is_active ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {w.is_active ? 'ACTIVE' : 'INACTIVE'}
            </span>
            <button
              onClick={() => deleteWebhook(w.id)}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <p className="text-xs font-semibold text-gray-300 mb-2">Supported Events</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 font-mono">
          {['order.created','order.updated','appointment.created','appointment.updated',
            'customer.created','customer.updated','support.created','support.updated'].map(e => (
            <span key={e}>{e}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── API Docs Panel ─────────────────────────────────────────────── */

function ApiDocsPanel() {
  const BASE = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd'}/api/v1`;

  const endpoints = [
    {
      method: 'GET', path: '/me', desc: 'Get your shop info and key type',
      example: null,
      response: `{ "shop": { "id": "...", "name": "My Shop", "category": "restaurant" }, "key_type": "live" }`,
    },
    {
      method: 'GET', path: '/customers', desc: 'List customers. Query: ?page=1&limit=20&search=name',
      example: null,
      response: `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 150 } }`,
    },
    {
      method: 'POST', path: '/customers', desc: 'Create a customer',
      example: `{ "name": "Rahim", "phone": "01711000000", "address": "Dhaka" }`,
      response: `{ "data": { "id": "...", "name": "Rahim", ... } }`,
    },
    {
      method: 'GET', path: '/orders', desc: 'List orders. Query: ?status=pending&type=order',
      example: null,
      response: `{ "data": [...], "meta": { ... } }`,
    },
    {
      method: 'POST', path: '/orders', desc: 'Create an order',
      example: `{ "customer_id": "uuid", "items": [{"name":"Biriyani","quantity":2}], "total_amount": 400 }`,
      response: `{ "data": { "id": "...", "status": "pending", ... } }`,
    },
    {
      method: 'GET', path: '/appointments', desc: 'List appointments',
      example: null,
      response: `{ "data": [...] }`,
    },
    {
      method: 'POST', path: '/appointments', desc: 'Book an appointment',
      example: `{ "customer_id": "uuid", "metadata": { "service_name": "Haircut", "booking_at": "2026-06-10 10:00" } }`,
      response: `{ "data": { "id": "...", "type": "appointment", ... } }`,
    },
    {
      method: 'GET', path: '/products', desc: 'List products/services. Query: ?available=true',
      example: null,
      response: `{ "data": [...] }`,
    },
    {
      method: 'POST', path: '/ai/chat', desc: 'Send a message to the shop AI and get a reply',
      example: `{ "message": "What is your price for a haircut?", "history": [] }`,
      response: `{ "reply": "Our haircut starts at ৳150..." }`,
    },
    {
      method: 'POST', path: '/ai/order', desc: 'Submit text and let AI extract + save an order',
      example: `{ "message": "I want to book Dr. Ali tomorrow at 3pm. Name: Rahim, Phone: 017..." }`,
      response: `{ "extracted": {...}, "order": {...}, "saved": true }`,
    },
    {
      method: 'GET', path: '/webhooks', desc: 'List your registered webhook endpoints',
      example: null,
      response: `{ "data": [{ "id": "...", "url": "https://...", "events": [...] }] }`,
    },
    {
      method: 'POST', path: '/webhooks', desc: 'Register a new webhook endpoint',
      example: `{ "url": "https://your-site.com/hook", "events": ["order.created","customer.created"] }`,
      response: `{ "data": { ..., "secret": "whsec_..." } }`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <p className="text-xs font-semibold text-gray-300 mb-1">Authentication</p>
        <p className="text-xs text-gray-500 mb-2">Add this header to every request:</p>
        <code className="block bg-gray-950 rounded p-2 text-xs text-emerald-400">
          Authorization: Bearer kb_live_your_key_here
        </code>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <p className="text-xs font-semibold text-gray-300 mb-1">Base URL</p>
        <code className="text-xs text-emerald-400">{BASE}</code>
      </div>

      <div className="space-y-3">
        {endpoints.map((ep, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                ep.method === 'GET' ? 'bg-blue-700 text-white' :
                ep.method === 'POST' ? 'bg-emerald-700 text-white' :
                'bg-amber-700 text-white'
              }`}>{ep.method}</span>
              <code className="text-sm text-white">{ep.path}</code>
              <span className="text-xs text-gray-500">{ep.desc}</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {ep.example && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Request Body</p>
                  <pre className="bg-gray-950 rounded p-2 text-xs text-gray-300 overflow-x-auto">{ep.example}</pre>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-500 uppercase mb-1">Response</p>
                <pre className="bg-gray-950 rounded p-2 text-xs text-gray-300 overflow-x-auto">{ep.response}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-300">Rate Limits</p>
        <p>60 requests per minute per API key.</p>
        <p>Headers: <code className="text-emerald-400">X-RateLimit-Limit</code>, <code className="text-emerald-400">X-RateLimit-Remaining</code>, <code className="text-emerald-400">X-RateLimit-Reset</code></p>
      </div>
    </div>
  );
}
