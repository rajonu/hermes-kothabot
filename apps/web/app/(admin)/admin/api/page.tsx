import { createAdminClient } from '@/lib/supabase/server';
import { AdminApiClient } from './AdminApiClient';

export default async function AdminApiPage() {
  const db = createAdminClient();

  const [{ data: keys }, { data: recentLogs }] = await Promise.all([
    (db as any)
      .from('api_keys')
      .select('id, shop_id, name, key_prefix, type, is_active, last_used_at, request_count, created_at, shops(name)')
      .order('created_at', { ascending: false })
      .limit(100),
    (db as any)
      .from('api_usage_logs')
      .select('shop_id, endpoint, method, status_code, duration_ms, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const totalRequests = recentLogs?.length ?? 0;
  const errorRequests = recentLogs?.filter((l: any) => l.status_code >= 400).length ?? 0;
  const activeKeys = keys?.filter((k: any) => k.is_active).length ?? 0;

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-bold text-white mb-1">API Management</h1>
      <p className="text-sm text-gray-500 mb-6">Monitor and manage all client API keys and usage.</p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Active Keys', value: activeKeys },
          { label: 'Total Keys', value: keys?.length ?? 0 },
          { label: 'Requests (7d)', value: totalRequests.toLocaleString() },
          { label: 'Errors (7d)', value: errorRequests.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <AdminApiClient initialKeys={keys ?? []} recentLogs={recentLogs ?? []} />
    </div>
  );
}
