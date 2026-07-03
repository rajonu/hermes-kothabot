import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props { params: Promise<{ shopId: string }> }

export default async function ClientUsagePage({ params }: Props) {
  const { shopId } = await params;
  const db = createAdminClient();

  const { data: shop } = await (db as any).from('shops')
    .select('id, name, category, ai_config')
    .eq('id', shopId)
    .single();

  if (!shop) notFound();

  const [
    { data: voiceSessions },
    { count: orderCount },
    { count: customerCount },
    { count: productCount },
    { data: knowledgeStats },
    { count: extractionCount },
    { count: backupCount },
    { data: calendarIntegration },
    { data: apiKeys },
    { data: subscription },
  ] = await Promise.all([
    (db as any).from('voice_sessions').select('duration_s, end_reason').eq('shop_id', shopId),
    (db as any).from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    (db as any).from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    (db as any).from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    (db as any).from('knowledge_chunks').select('source_type, word_count').eq('shop_id', shopId),
    (db as any).from('knowledge_sources').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'done'),
    (db as any).from('backups').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    (db as any).from('calendar_integrations').select('events_created, events_updated, events_cancelled, sync_errors, last_sync_at').eq('shop_id', shopId).maybeSingle(),
    (db as any).from('api_keys').select('id, request_count, last_used_at').eq('shop_id', shopId).eq('revoked', false),
    (db as any).from('subscriptions').select('plan_id, status, minutes_used, call_count').eq('shop_id', shopId).maybeSingle(),
  ]);

  const sessions = voiceSessions ?? [];
  const totalMinutes = Math.round(sessions.reduce((s: number, v: any) => s + (v.duration_s || 0), 0) / 6) / 10;
  const sessionCount = sessions.length;
  const endReasons = sessions.reduce((acc: Record<string, number>, v: any) => {
    const r = v.end_reason || 'unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chunks = knowledgeStats ?? [];
  const websiteChunks = chunks.filter((c: any) => c.source_type === 'website').length;
  const wordpressChunks = chunks.filter((c: any) => c.source_type === 'wordpress').length;
  const totalWords = chunks.reduce((s: number, c: any) => s + (c.word_count || 0), 0);

  const totalApiRequests = (apiKeys ?? []).reduce((s: number, k: any) => s + (k.request_count || 0), 0);

  // Gemini Usage approximation: 1 session per call + 1 per 90s chunk + extractions
  const totalDurationS = sessions.reduce((s: number, v: any) => s + (v.duration_s || 0), 0);
  const geminiVoiceSessions = sessionCount + Math.floor(totalDurationS / 90);
  const geminiExtractions = extractionCount ?? 0;
  const geminiTotal = geminiVoiceSessions + geminiExtractions;

  const region = shop.ai_config?.billing_region;
  const plan = subscription?.plan_id ?? 'none';

  const metrics = [
    { label: 'Voice Minutes', value: `${totalMinutes}m`, sub: `${sessionCount} sessions` },
    { label: 'Gemini Usage', value: geminiTotal, sub: `${geminiVoiceSessions} voice · ${geminiExtractions} extractions` },
    { label: 'Orders', value: orderCount ?? 0 },
    { label: 'Customers', value: customerCount ?? 0 },
    { label: 'Products', value: productCount ?? 0 },
    { label: 'Knowledge Entries', value: chunks.length, sub: `${totalWords.toLocaleString()} words · ${websiteChunks} web · ${wordpressChunks} WP` },
    { label: 'Extractions', value: extractionCount ?? 0 },
    { label: 'API Requests', value: totalApiRequests, sub: `${(apiKeys ?? []).length} active keys` },
    { label: 'Backups', value: backupCount ?? 0 },
    { label: 'Calendar Events', value: calendarIntegration?.events_created ?? 0, sub: calendarIntegration ? `Updated: ${calendarIntegration.events_updated ?? 0}` : 'Not connected' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/admin/shops/${shopId}`} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">{shop.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 capitalize">{shop.category}</span>
            {region && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${region === 'BD' ? 'bg-emerald-600/15 text-emerald-400' : 'bg-cyan-600/15 text-cyan-400'}`}>
                {region === 'BD' ? '🇧🇩 BD' : '🌍 Global'}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 capitalize">{plan}</span>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* End-reason breakdown */}
      {sessionCount > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Call End Reasons</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(endReasons).map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-2 text-sm">
                <span className="text-gray-300 capitalize">{reason.replace(/_/g, ' ')}</span>
                <span className="text-xs font-mono text-gray-500">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription usage */}
      {subscription && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Period Usage</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Minutes Used</p>
              <p className="text-lg font-bold text-white">{subscription.minutes_used ?? 0}m</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Calls This Period</p>
              <p className="text-lg font-bold text-white">{subscription.call_count ?? 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
