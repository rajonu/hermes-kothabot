import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { GEMINI_MODELS, DEFAULT_MODEL, TEXT_MODELS, DEFAULT_TEXT_MODEL } from '@/lib/admin';
import { updateShopModel, updateShopTextModel } from '@/modules/admin/actions';
import { ShopModelSelector } from './ShopModelSelector';
import { PlanSelector } from './PlanSelector';
import { RegionOverride } from './RegionOverride';
import { CategoryOverride } from './CategoryOverride';
import { ClientAccessPanel } from './ClientAccessPanel';
import { DeleteShopButton } from './DeleteShopButton';
import { UsagePanel } from './UsagePanel';
import { FeatureToggle } from './FeatureToggle';
import { getPlatformSettings } from '@/lib/platform-settings';

// Convert ISO country code to flag emoji
function countryFlag(code: string): string {
  if (!code || code === 'DEV') return '🏠';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}

interface Props { params: Promise<{ shopId: string }> }

export default async function AdminShopPage({ params }: Props) {
  const { shopId } = await params;
  const db = createAdminClient();

  // Load shop + its recent orders + recent voice sessions + login activity + support tickets
  const [shopRes, ordersRes, sessionsRes, subRes, loginRes, ticketsRes] = await Promise.all([
    (db as any).from('shops').select('*').eq('id', shopId).single(),
    (db as any).from('orders').select('id, type, status, total_amount, created_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(10),
    (db as any).from('voice_sessions').select('id, status, duration_s, created_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(10),
    (db as any).from('subscriptions').select('id, plan_id, status, current_period_end, calls_used, minutes_used, extra_calls, extra_minutes').eq('shop_id', shopId).single(),
    (db as any).from('login_activity').select('id, ip_address, browser, city, country, country_code, created_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(5),
    (db as any).from('support_tickets').select('id, subject, status, unread_admin, created_at, updated_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(20),
  ]);

  if (!shopRes.data) notFound();
  const shop = shopRes.data as any;
  const orders = ordersRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const currentModel  = shop.ai_config?.ai_model ?? DEFAULT_MODEL;
  const currentTextModel = shop.ai_config?.text_model ?? DEFAULT_TEXT_MODEL;
  const subscription  = subRes.data as any;
  const currentPlan   = subscription?.plan_id ?? 'trial';

  // Fetch platform settings for call_limit
  const platformSettings = await getPlatformSettings();
  const planCallLimit = platformSettings.plans[currentPlan as keyof typeof platformSettings.plans]?.call_limit ?? 100;
  const loginActivity  = loginRes.data ?? [];
  const tickets        = ticketsRes.data ?? [];

  // Fetch owner email from Supabase auth
  let ownerEmail = '';
  try {
    const { data: authUser } = await db.auth.admin.getUserById(shop.owner_id);
    ownerEmail = authUser?.user?.email ?? '';
  } catch { /* non-fatal */ }

  const billingRegion = ((shop.ai_config?.billing_region ?? 'BD') === 'INTL' ? 'INTL' : 'BD') as 'BD' | 'INTL';

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
        <Link href="/admin/clients" className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-white truncate">{shop.name}</h1>
          <p className="text-xs text-gray-500 font-mono truncate hidden sm:block">{shop.id}</p>
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <Link
            href={`/admin/clients/${shopId}/usage`}
            className="text-xs px-2.5 sm:px-3 py-1.5 rounded-lg bg-cyan-600/15 text-cyan-400 border border-cyan-600/20 hover:bg-cyan-600/25 transition-colors whitespace-nowrap"
          >
            Usage
          </Link>
          <Link
            href={`/widget/${shopId}`}
            target="_blank"
            className="text-xs px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/25 transition-colors whitespace-nowrap"
          >
            <span className="hidden sm:inline">Preview Widget →</span>
            <span className="sm:hidden">Preview →</span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">

        {/* Shop info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Category',   value: shop.category },
            { label: 'Joined',     value: formatDate(shop.created_at) },
            { label: 'Orders',     value: orders.length },
            { label: 'Calls',      value: sessions.length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Client Account Access ────────────────────────────────── */}
        <div className="rounded-xl border border-amber-600/20 bg-amber-600/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-600/15 flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Client Account Access</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Send a password reset or generate a one-time login link to access their account without their password.
              </p>
            </div>
          </div>
          <div className="p-5">
            {ownerEmail
              ? <ClientAccessPanel shopId={shopId} ownerEmail={ownerEmail} />
              : <p className="text-xs text-gray-500">Could not load owner email.</p>
            }
          </div>
        </div>

        {/* ── Support Tickets ───────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Support Tickets</h2>
              <p className="text-xs text-gray-400 mt-0.5">{tickets.length} total tickets for this shop.</p>
            </div>
            <a
              href={`/admin/support`}
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Manage all →
            </a>
          </div>
          {tickets.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No support tickets yet.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Subject', 'Status', 'Unread', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t: any, i: number) => (
                  <tr key={t.id} className={`hover:bg-gray-800/50 ${i < tickets.length - 1 ? 'border-b border-gray-800' : ''}`}>
                    <td className="px-5 py-3">
                      <a href={`/admin/support?ticket=${t.id}`} className="text-xs text-white hover:text-emerald-400 transition-colors font-medium">
                        {t.subject}
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.status === 'resolved' ? 'bg-emerald-600/15 text-emerald-400' :
                        t.status === 'pending'  ? 'bg-amber-600/15 text-amber-400' :
                        'bg-cyan-600/15 text-cyan-400'
                      }`}>{t.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      {t.unread_admin
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">New</span>
                        : <span className="text-xs text-gray-600">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {/* ── Category Override ────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Business Category</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Locked for clients — only God Admin can change. Affects the Products panel layout.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-700 text-gray-300 border border-gray-600 capitalize">
              {shop.category}
            </span>
          </div>
          <div className="p-5">
            <CategoryOverride shopId={shopId} currentCategory={shop.category} />
          </div>
        </div>

        {/* ── Billing Region Override ──────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Billing Region</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Detected once at signup from client IP. Change here if incorrect.
              </p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              billingRegion === 'INTL'
                ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
                : 'text-green-400 bg-green-400/10 border-green-400/20'
            }`}>
              {billingRegion === 'INTL' ? '🌍 Global' : '🇧🇩 Bangladesh'}
            </span>
          </div>
          <div className="p-5">
            <RegionOverride shopId={shopId} currentRegion={billingRegion} />
          </div>
        </div>

        {/* ── Subscription Plan ────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Subscription Plan</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage this shop's billing plan.</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
              currentPlan === 'business' ? 'bg-amber-600/15 text-amber-400 border border-amber-600/20' :
              currentPlan === 'pro'      ? 'bg-cyan-600/15 text-cyan-400 border border-cyan-600/20' :
              currentPlan === 'starter'  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20' :
              'bg-gray-700 text-gray-400 border border-gray-600'
            } capitalize`}>
              {currentPlan}
            </span>
          </div>
          <div className="p-5">
            <PlanSelector
              shopId={shopId}
              currentPlan={currentPlan as any}
              expiresAt={subscription?.current_period_end}
              extraCalls={subscription?.extra_calls ?? 0}
              extraMinutes={subscription?.extra_minutes ?? 0}
              planCallLimit={platformSettings.plans[currentPlan as keyof typeof platformSettings.plans]?.call_limit ?? 30}
              planMinuteLimit={(platformSettings.plans[currentPlan as keyof typeof platformSettings.plans] as any)?.minute_limit ?? 30}
            />
          </div>
        </div>

        {/* ── Usage Limits ─────────────────────────────────────────── */}
        {subscription?.id && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Usage Limits</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Monitor call and minute usage. Add extra quota or reset the counter.
                </p>
              </div>
            </div>
            <div className="p-5">
              <UsagePanel
                shopId={shopId}
                planId={currentPlan}
                callLimit={planCallLimit}
                callsUsed={subscription.calls_used ?? 0}
                minutesUsed={subscription.minutes_used ?? 0}
                extraCalls={subscription.extra_calls ?? 0}
                extraMinutes={subscription.extra_minutes ?? 0}
                subscriptionId={subscription.id}
              />
            </div>
          </div>
        )}

        {/* ── AI Model Selector (Voice) ────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">AI Model — Voice</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose which Gemini Live model powers this shop's voice assistant.</p>
          </div>
          <div className="p-5">
            <ShopModelSelector shopId={shopId} currentModel={currentModel} models={GEMINI_MODELS} onSave={updateShopModel} />
          </div>
        </div>

        {/* ── AI Model Selector (Text) ─────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">AI Model — Text Chat</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose which Gemini model powers text chat, Messenger, and WhatsApp replies.</p>
          </div>
          <div className="p-5">
            <ShopModelSelector shopId={shopId} currentModel={currentTextModel} models={TEXT_MODELS} onSave={updateShopTextModel} />
          </div>
        </div>

        {/* ── Feature Toggles (God Admin only) ─────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Feature Access</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              All toggles default OFF. Enable per shop when ready.
            </p>
          </div>
          <div className="p-5 divide-y divide-gray-800">
            <div className="pb-4">
              <FeatureToggle
                shopId={shopId}
                flag="voip_enabled"
                enabled={!!shop.ai_config?.voip_enabled}
                label="VoIP / SIP Telephony"
                description="Allow this shop to connect an IP phone number to the AI assistant."
              />
            </div>
            <div className="py-4">
              <FeatureToggle
                shopId={shopId}
                flag="api_access_enabled"
                enabled={!!shop.ai_config?.api_access_enabled}
                label="Public API Access"
                description="Allow this shop to generate API keys and use the v1 REST endpoints."
              />
            </div>
            <div className="pt-4">
              <FeatureToggle
                shopId={shopId}
                flag="white_label"
                enabled={!!shop.ai_config?.white_label}
                label="White-Label Mode"
                description="Remove KothaBot branding. AI identifies as the business's own assistant."
              />
            </div>
          </div>
        </div>

        {/* ── Client Settings Snapshot ──────────────────────────────── */}
        {(() => {
          const ai  = (shop.ai_config    as any) ?? {};
          const wc  = (shop.widget_config as any) ?? {};
          const rows = [
            { label: 'AI Persona Name',  value: ai.name        ?? '—' },
            { label: 'Language',         value: ai.language    ?? 'auto' },
            { label: 'Personality',      value: ai.personality ?? 'professional' },
            { label: 'Greeting',         value: wc.greeting    ?? '—' },
            { label: 'Primary Colour',   value: wc.primaryColor ?? '—' },
            { label: 'Voice Enabled',    value: wc.enable_voice !== false ? 'Yes' : 'No' },
            { label: 'Text Enabled',     value: wc.enable_text  !== false ? 'Yes' : 'No' },
            { label: 'Collects Name',    value: ai.collect_fields?.name    !== false ? 'Yes' : 'No' },
            { label: 'Collects Phone',   value: ai.collect_fields?.phone   !== false ? 'Yes' : 'No' },
          ];
          return (
            <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Client Settings Snapshot</h2>
                <a href={`/admin/support`} className="text-xs text-gray-500">Read-only — client edits in their Settings page</a>
              </div>
              <div className="divide-y divide-gray-800">
                {rows.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-medium text-white max-w-[60%] text-right truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ai_config JSON viewer */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">AI Config (raw)</h2>
          </div>
          <pre className="p-5 text-xs text-emerald-400 font-mono overflow-x-auto">
            {JSON.stringify(shop.ai_config, null, 2)}
          </pre>
        </div>

        {/* ── Login Activity ────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Login Activity</h2>
            {loginActivity.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-emerald-400 font-semibold">
                  Last seen: {new Date(loginActivity[0].created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(loginActivity[0].created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {loginActivity[0].city && loginActivity[0].country
                    ? `📍 ${loginActivity[0].city}, ${loginActivity[0].country}`
                    : loginActivity[0].ip_address ?? ''}
                </p>
              </div>
            )}
          </div>
          {loginActivity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No logins recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Date & Time', 'Browser / Device', 'IP Address', 'Location'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loginActivity.map((log: any, i: number) => {
                    const date = new Date(log.created_at);
                    const isLatest = i === 0;
                    return (
                      <tr key={log.id} className={`hover:bg-gray-800/50 ${i < loginActivity.length - 1 ? 'border-b border-gray-800' : ''}`}>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className={`text-xs font-medium ${isLatest ? 'text-emerald-400' : 'text-white'}`}>
                            {date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            {isLatest && <span className="ml-1.5 text-emerald-500 font-semibold">← Latest</span>}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-white">{log.browser ?? 'Unknown'}</p>
                        </td>
                        <td className="px-5 py-3">
                          <code className="text-xs font-mono text-gray-400">{log.ip_address ?? '—'}</code>
                        </td>
                        <td className="px-5 py-3">
                          {log.city || log.country ? (
                            <p className="text-xs text-gray-300">
                              {log.country_code && <span className="mr-1">{countryFlag(log.country_code)}</span>}
                              {[log.city, log.country].filter(Boolean).join(', ')}
                            </p>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Recent Voice Calls</h2>
          </div>
          {sessions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No calls yet.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['ID', 'Status', 'Duration', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any, i: number) => (
                  <tr key={s.id} className={`hover:bg-gray-800/50 ${i < sessions.length - 1 ? 'border-b border-gray-800' : ''}`}>
                    <td className="px-5 py-3 text-xs font-mono text-gray-400">{s.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === 'completed' ? 'bg-emerald-600/15 text-emerald-400' :
                        s.status === 'active'    ? 'bg-cyan-600/15 text-cyan-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{s.duration_s ? `${s.duration_s}s` : '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Recent Orders</h2>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Type', 'Status', 'Amount', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any, i: number) => (
                  <tr key={o.id} className={`hover:bg-gray-800/50 ${i < orders.length - 1 ? 'border-b border-gray-800' : ''}`}>
                    <td className="px-5 py-3 text-xs text-white capitalize">{o.type}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.status === 'completed' ? 'bg-emerald-600/15 text-emerald-400' :
                        o.status === 'pending'   ? 'bg-amber-600/15 text-amber-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-white">{o.total_amount ? `৳${o.total_amount}` : '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {/* ── Danger Zone ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-red-600/20 bg-red-600/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-red-600/15">
            <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Permanently delete this shop and all associated data. Requires double confirmation.
            </p>
          </div>
          <div className="p-5">
            <DeleteShopButton shopId={shopId} shopName={shop.name} />
          </div>
        </div>

      </div>
    </div>
  );
}
