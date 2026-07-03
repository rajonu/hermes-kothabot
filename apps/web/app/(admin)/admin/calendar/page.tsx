import { createAdminClient } from '@/lib/supabase/server';
import { AdminCalendarClient } from './AdminCalendarClient';

export default async function AdminCalendarPage() {
  const db = createAdminClient();
  const { data: integrations } = await (db as any)
    .from('calendar_integrations')
    .select('id, shop_id, google_email, calendar_id, connected_at, last_sync_at, auto_sync, events_created, events_updated, events_cancelled, sync_errors, shops(name, category)')
    .order('connected_at', { ascending: false });

  const connected = integrations?.length ?? 0;
  const totalEvents = integrations?.reduce((s: number, i: any) => s + (i.events_created ?? 0), 0) ?? 0;
  const totalErrors = integrations?.reduce((s: number, i: any) => s + (i.sync_errors ?? 0), 0) ?? 0;

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-bold text-white mb-1">Google Calendar Integrations</h1>
      <p className="text-sm text-gray-500 mb-6">Monitor all client calendar connections and sync status.</p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Connected Clients', value: connected },
          { label: 'Total Events Synced', value: totalEvents.toLocaleString() },
          { label: 'Sync Errors', value: totalErrors, red: totalErrors > 0 },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border ${(s as any).red ? 'bg-red-900/10 border-red-800/40' : 'bg-gray-900 border-gray-800'}`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${(s as any).red && s.value > 0 ? 'text-red-400' : 'text-white'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <AdminCalendarClient integrations={integrations ?? []} />
    </div>
  );
}
