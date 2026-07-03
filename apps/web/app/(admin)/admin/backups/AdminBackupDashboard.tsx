'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive, RotateCcw, Trash2, Loader2, CheckCircle, XCircle,
  Download, Search, AlertTriangle, Building2, Filter, Upload, Layers,
} from 'lucide-react';

interface Backup {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  shop_category: string | null;
  backup_type: string;
  label: string | null;
  status: string;
  size_bytes: number;
  created_by: string;
  created_at: string;
}

interface Log {
  id: string;
  shop_id: string | null;
  backup_id: string | null;
  action: string;
  backup_type: string | null;
  performed_by: string;
  notes: string | null;
  created_at: string;
}

interface Shop {
  id: string;
  name: string;
  category: string;
}

interface Props {
  backups: Backup[];
  logs: Log[];
  total: number;
  shops: Shop[];
}

function fmtSize(b: number) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_COLOR: Record<string, string> = {
  manual:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
  daily:       'text-purple-400 bg-purple-500/10 border-purple-500/20',
  weekly:      'text-amber-400 bg-amber-500/10 border-amber-500/20',
  pre_restore: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  platform:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const ACTION_COLOR: Record<string, string> = {
  created:             'text-emerald-400',
  restored:            'text-amber-400',
  deleted:             'text-red-400',
  failed:              'text-red-400',
  pre_restore_created: 'text-blue-400',
};

export function AdminBackupDashboard({ backups: initial, logs: initialLogs, total, shops }: Props) {
  const router                          = useRouter();
  const [backups, setBackups]           = useState<Backup[]>(initial);
  const [logs]                          = useState<Log[]>(initialLogs);
  const [tab, setTab]                   = useState<'backups' | 'logs'>('backups');
  const [pending, start]                = useTransition();
  const [msg, setMsg]                   = useState('');
  const [search, setSearch]             = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [restoreTarget, setRestoreTarget] = useState<{ backupId: string; shopId: string; shopName: string } | null>(null);
  const [clientBackupOpen, setClientBackupOpen] = useState(false);
  const [clientBackupShop, setClientBackupShop] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadShop, setUploadShop] = useState('');
  const [uploadPayload, setUploadPayload] = useState<any>(null);
  const [uploadFileName, setUploadFileName] = useState('');

  const successCount = backups.filter(b => b.status === 'completed').length;
  const failedCount  = backups.filter(b => b.status === 'failed').length;
  const totalSize    = backups.reduce((s, b) => s + (b.size_bytes ?? 0), 0);

  // Unique clients that have backups
  const clientsWithBackups = shops.filter(s => backups.some(b => b.shop_id === s.id));

  const filtered = backups.filter(b => {
    const matchSearch = !search
      || (b.shop_name ?? '').toLowerCase().includes(search.toLowerCase())
      || (b.label ?? '').toLowerCase().includes(search.toLowerCase());
    const matchClient = clientFilter === 'all' || b.shop_id === clientFilter;
    const matchType   = typeFilter === 'all' || b.backup_type === typeFilter;
    return matchSearch && matchClient && matchType;
  });

  const handleAdminRestore = (backup: Backup) => {
    if (!backup.shop_id) { setMsg('❌ Platform backups cannot be restored via this button.'); return; }
    setRestoreTarget({ backupId: backup.id, shopId: backup.shop_id, shopName: backup.shop_name ?? 'this client' });
  };

  const confirmAdminRestore = () => {
    if (!restoreTarget) return;
    setMsg('');
    start(async () => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_for_client', backupId: restoreTarget.backupId, shopId: restoreTarget.shopId }),
      });
      const d = await res.json();
      setRestoreTarget(null);
      setMsg(res.ok ? `✅ Data restored for ${restoreTarget.shopName}!` : `❌ ${d.error ?? 'Restore failed'}`);
      if (res.ok) router.refresh();
    });
  };

  const handleDelete = (id: string, shopId: string | null) => {
    if (!confirm('Delete this backup? This cannot be undone.')) return;
    start(async () => {
      await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', backupId: id, shopId }),
      });
      setBackups(prev => prev.filter(b => b.id !== id));
    });
  };

  const handlePlatformBackup = () => {
    setMsg('');
    start(async () => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_platform' }),
      });
      const d = await res.json();
      setMsg(res.ok ? '✅ Platform backup created!' : `❌ ${d.error ?? 'Failed'}`);
      if (res.ok) router.refresh();
    });
  };

  const handleCreateForClient = () => {
    if (!clientBackupShop) { setMsg('❌ Please pick a client.'); return; }
    const shop = shops.find(s => s.id === clientBackupShop);
    setMsg('');
    start(async () => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_for_client', shopId: clientBackupShop }),
      });
      const d = await res.json();
      setClientBackupOpen(false);
      setMsg(res.ok ? `✅ Backup created for ${shop?.name}` : `❌ ${d.error ?? 'Failed'}`);
      if (res.ok) router.refresh();
    });
  };

  const handleBackupAllClients = () => {
    if (!confirm(`Create a backup for all ${shops.length} clients? This may take a moment.`)) return;
    setMsg('');
    start(async () => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_all_clients' }),
      });
      const d = await res.json();
      const failed = (d.results ?? []).filter((r: any) => !r.success).length;
      setMsg(res.ok
        ? `✅ Backed up ${d.total - failed}/${d.total} clients${failed ? ` (${failed} failed)` : ''}`
        : `❌ ${d.error ?? 'Failed'}`);
      if (res.ok) router.refresh();
    });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('Not a valid backup');
      setUploadPayload(parsed);
      setUploadFileName(file.name);
    } catch (err: any) {
      setMsg(`❌ Could not read file: ${err?.message ?? 'invalid JSON'}`);
      setUploadPayload(null);
      setUploadFileName('');
    }
  };

  const handleRestoreFromUpload = () => {
    if (!uploadShop || !uploadPayload) { setMsg('❌ Pick a client and upload a valid backup file.'); return; }
    const shop = shops.find(s => s.id === uploadShop);
    if (!confirm(`Restore uploaded backup → ${shop?.name}? This OVERWRITES current data. A pre-restore safety backup will be created.`)) return;
    setMsg('');
    start(async () => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_from_upload', shopId: uploadShop, payload: uploadPayload }),
      });
      const d = await res.json();
      setUploadOpen(false);
      setUploadPayload(null);
      setUploadFileName('');
      setUploadShop('');
      setMsg(res.ok ? `✅ Restored to ${shop?.name} from uploaded backup` : `❌ ${d.error ?? 'Failed'}`);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* Restore confirmation modal */}
      {restoreTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Restore Client Data?</p>
                <p className="text-xs text-amber-400 font-medium">{restoreTarget.shopName}</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
              This will overwrite <strong>{restoreTarget.shopName}</strong>'s current business data. A pre-restore safety backup will be created automatically.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setRestoreTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={confirmAdminRestore} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Yes, Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Backups', value: total,        color: 'text-white' },
          { label: 'Successful',    value: successCount, color: 'text-emerald-400' },
          { label: 'Failed',        value: failedCount,  color: 'text-red-400' },
          { label: 'Storage Used',  value: fmtSize(totalSize), color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-gray-800 border border-gray-700 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {msg && <p className="text-xs text-gray-300 bg-gray-800 border border-gray-700 px-3 py-2.5 rounded-lg">{msg}</p>}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handlePlatformBackup}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
          Full Platform Backup
        </button>
        <button
          onClick={() => { setClientBackupOpen(true); setClientBackupShop(''); }}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          <Building2 size={14} />
          Backup a Client
        </button>
        <button
          onClick={handleBackupAllClients}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          <Layers size={14} />
          Backup All Clients
        </button>
        <button
          onClick={() => { setUploadOpen(true); setUploadShop(''); setUploadPayload(null); setUploadFileName(''); }}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          <Upload size={14} />
          Upload & Restore
        </button>
      </div>

      {/* Backup a Client modal */}
      {clientBackupOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div>
              <p className="text-sm font-bold text-white">Backup a Client</p>
              <p className="text-xs text-gray-400 mt-0.5">Select a shop to snapshot.</p>
            </div>
            <select
              value={clientBackupShop}
              onChange={e => setClientBackupShop(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">— Pick a client —</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setClientBackupOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateForClient} disabled={pending || !clientBackupShop}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Create Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload & Restore modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div>
              <p className="text-sm font-bold text-white">Upload Backup & Restore</p>
              <p className="text-xs text-gray-400 mt-0.5">Upload a previously downloaded JSON backup and restore it to a client.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Backup file (.json)</label>
              <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 border border-gray-700 border-dashed rounded-lg text-sm text-gray-300 hover:border-amber-500 cursor-pointer transition-colors">
                <Upload size={14} className="text-amber-400" />
                <span className="flex-1 truncate">{uploadFileName || 'Choose JSON file…'}</span>
                <input type="file" accept="application/json,.json" className="hidden" onChange={handleUploadFile} />
              </label>
              {uploadPayload && (
                <p className="text-[11px] text-emerald-400 mt-1.5">
                  ✅ Loaded — {uploadPayload.shop?.name ?? 'unnamed shop'} · {uploadPayload.products?.length ?? 0} products · {uploadPayload.orders?.length ?? 0} orders
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Restore into client</label>
              <select
                value={uploadShop}
                onChange={e => setUploadShop(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">— Pick a client —</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              ⚠️ This overwrites the target client's current data. A pre-restore safety backup is created automatically.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setUploadOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleRestoreFromUpload} disabled={pending || !uploadShop || !uploadPayload}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Upload & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit">
        {(['backups', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'backups' ? `Backups (${filtered.length})` : `Audit Log (${logs.length})`}
          </button>
        ))}
      </div>

      {/* Backups tab */}
      {tab === 'backups' && (
        <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-700 flex flex-wrap gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by business name…"
                className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {/* Client dropdown */}
            <div className="relative">
              <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                value={clientFilter}
                onChange={e => setClientFilter(e.target.value)}
                className="pl-8 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 appearance-none min-w-[160px]"
              >
                <option value="all">All Clients</option>
                {clientsWithBackups.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* Type dropdown */}
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="pl-8 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 appearance-none min-w-[140px]"
              >
                <option value="all">All Types</option>
                <option value="manual">Manual</option>
                <option value="daily">Auto Daily</option>
                <option value="weekly">Auto Weekly</option>
                <option value="pre_restore">Pre-Restore</option>
                <option value="platform">Platform</option>
              </select>
            </div>
          </div>

          {/* Backup rows */}
          <div className="divide-y divide-gray-700 max-h-[520px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">No backups match filters</div>
            ) : filtered.map(backup => (
              <div key={backup.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-700/20 transition-colors">
                {/* Business info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {/* Type badge */}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold capitalize ${TYPE_COLOR[backup.backup_type] ?? TYPE_COLOR.manual}`}>
                      {backup.backup_type === 'pre_restore' ? 'Pre-Restore' :
                       backup.backup_type === 'daily' ? 'Auto Daily' :
                       backup.backup_type === 'weekly' ? 'Auto Weekly' :
                       backup.backup_type.charAt(0).toUpperCase() + backup.backup_type.slice(1)}
                    </span>

                    {/* Business name */}
                    {backup.shop_name ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-white">
                        <Building2 size={11} className="text-gray-400" />
                        {backup.shop_name}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600/15 text-emerald-400 font-medium">Platform</span>
                    )}

                    {/* Category */}
                    {backup.shop_category && (
                      <span className="text-[10px] text-gray-500 capitalize">{backup.shop_category}</span>
                    )}

                    {backup.status === 'failed' && <XCircle size={12} className="text-red-400" />}
                  </div>

                  {/* Label / notes */}
                  {backup.label && (
                    <p className="text-[11px] text-gray-500 mb-0.5">{backup.label}</p>
                  )}

                  {/* Meta */}
                  <p className="text-[11px] text-gray-600">
                    {fmtDate(backup.created_at)} · {fmtSize(backup.size_bytes)}
                    {backup.created_by !== 'system' && backup.created_by !== 'admin' &&
                      ` · client`}
                    {backup.created_by === 'admin' && ` · by admin`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {backup.shop_id && (
                    <button
                      onClick={() => handleAdminRestore(backup)}
                      disabled={pending}
                      className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                      title={`Restore data for ${backup.shop_name}`}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  <a
                    href={`/api/backup/download?id=${backup.id}`}
                    target="_blank"
                    className="p-2 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                    title="Download JSON"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => handleDelete(backup.id, backup.shop_id)}
                    disabled={pending}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete backup"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
          <div className="divide-y divide-gray-700 max-h-[480px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">No audit logs yet</div>
            ) : logs.map(log => {
              const shopName = log.shop_id
                ? (shops.find(s => s.id === log.shop_id)?.name ?? log.shop_id.slice(0, 8) + '…')
                : 'Platform';
              return (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <CheckCircle size={12} className={`mt-0.5 shrink-0 ${ACTION_COLOR[log.action] ?? 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold capitalize ${ACTION_COLOR[log.action] ?? 'text-gray-400'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-white font-medium">{shopName}</span>
                      {log.backup_type && (
                        <span className="text-[10px] text-gray-500 capitalize">{log.backup_type}</span>
                      )}
                    </div>
                    {log.notes && <p className="text-[11px] text-gray-500 mt-0.5">{log.notes}</p>}
                    <p className="text-[10px] text-gray-600 mt-0.5">{fmtDate(log.created_at)} · {log.performed_by}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
