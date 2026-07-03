import { createAdminClient } from '@/lib/supabase/server';
import { ShieldAlert } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  admin_login:       'text-emerald-400 bg-emerald-400/10',
  admin_logout:      'text-gray-400 bg-gray-400/10',
  admin_pin_failed:  'text-red-400 bg-red-400/10',
  admin_pin_locked:  'text-red-500 bg-red-500/15',
  approve_payment:   'text-emerald-400 bg-emerald-400/10',
  reject_payment:    'text-red-400 bg-red-400/10',
  update_settings:   'text-cyan-400 bg-cyan-400/10',
  extend_trial:      'text-amber-400 bg-amber-400/10',
};

export default async function AuditLogPage() {
  const db = createAdminClient();
  const { data: logs } = await (db as any)
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="flex items-center gap-2 mb-5">
          <ShieldAlert size={15} className="text-amber-400 shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-white">Audit Log</h1>
            <p className="text-xs text-gray-500">All admin actions recorded</p>
          </div>
        </div>
        {!logs || logs.length === 0 ? (
          <p className="text-center py-16 text-gray-500">No actions recorded yet.</p>
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">

            {/* ── Mobile card view (< sm) ── */}
            <div className="sm:hidden divide-y divide-gray-800">
              {logs.map((log: any) => {
                const date  = new Date(log.created_at);
                const color = ACTION_COLORS[log.action] ?? 'text-gray-400 bg-gray-700';
                return (
                  <div key={log.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg ${color}`}>
                        {log.action}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {date.toLocaleDateString('en', { day: 'numeric', month: 'short' })} {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {(log.target_type || log.target_id) && (
                      <p className="text-[11px] text-gray-400">
                        {log.target_type && <span className="text-gray-500">{log.target_type}: </span>}
                        {log.target_id ? <span className="font-mono">{log.target_id.slice(0, 12)}…</span> : null}
                      </p>
                    )}
                    {log.ip_address && (
                      <p className="text-[10px] text-gray-600 font-mono">{log.ip_address}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table view (≥ sm) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950">
                    {['Time', 'Action', 'Target', 'Admin', 'IP'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any, i: number) => {
                    const date  = new Date(log.created_at);
                    const color = ACTION_COLORS[log.action] ?? 'text-gray-400 bg-gray-700';
                    return (
                      <tr key={log.id} className={`hover:bg-gray-800/50 ${i < logs.length - 1 ? 'border-b border-gray-800' : ''}`}>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {date.toLocaleDateString('en', { day: 'numeric', month: 'short' })}{' '}
                          {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono font-semibold px-2 py-1 rounded-lg ${color}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {log.target_type && <span className="text-gray-500">{log.target_type}: </span>}
                          {log.target_id ? <span className="font-mono">{log.target_id.slice(0, 12)}…</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-[150px]">
                          {log.admin_email}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {log.ip_address ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
  );
}
