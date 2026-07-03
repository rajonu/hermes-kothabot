import { createAdminClient } from '@/lib/supabase/server';

export default async function VoiceLinksSettingsPage() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [shopsRes, visitsRes] = await Promise.all([
    (db as any).from('shops')
      .select('id, name, public_slug, public_access_enabled')
      .order('created_at', { ascending: false }),
    (db as any).from('public_link_visits')
      .select('shop_id, event_type')
      .gte('created_at', since),
  ]);

  const shops = (shopsRes.data ?? []) as Array<{
    id: string; name: string; public_slug: string | null; public_access_enabled: boolean;
  }>;
  const allVisits = (visitsRes.data ?? []) as Array<{ shop_id: string; event_type: string }>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Public Voice Links</h2>
          <p className="text-xs text-gray-400 mt-0.5">All shops with public voice links configured (last 30 days stats).</p>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Shop</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Slug</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">Visits</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">Voice Starts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {shops.filter((s) => s.public_slug).map((s) => {
                const shopVisits = allVisits.filter((v) => v.shop_id === s.id);
                const visitCount = shopVisits.filter((v) => v.event_type === 'visit').length;
                const voiceCount = shopVisits.filter((v) => v.event_type === 'voice_start').length;
                return (
                  <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-5 py-3 font-mono text-emerald-400 text-xs">{s.public_slug}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.public_access_enabled
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                          : 'bg-gray-700 text-gray-400 border border-gray-600'
                      }`}>
                        {s.public_access_enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-300">{visitCount}</td>
                    <td className="px-5 py-3 text-center text-emerald-400 font-medium">{voiceCount}</td>
                  </tr>
                );
              })}
              {shops.filter((s) => s.public_slug).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-gray-500 text-sm">
                    No shops have configured voice links yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
