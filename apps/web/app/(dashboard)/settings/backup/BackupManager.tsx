'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive, Download, RotateCcw, Plus, Loader2, CheckCircle,
  AlertTriangle, Clock, Shield, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Backup {
  id: string;
  backup_type: string;
  label: string | null;
  status: string;
  size_bytes: number;
  created_at: string;
  created_by: string;
}

interface Log {
  id: string;
  action: string;
  backup_type: string | null;
  performed_by: string;
  notes: string | null;
  created_at: string;
}

interface Props {
  shopId: string;
  shopName: string;
}

function fmtSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_BADGE: Record<string, string> = {
  manual:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
  daily:       'bg-purple-500/20 text-purple-400 border-purple-500/30',
  weekly:      'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pre_restore: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  manual:      'Manual',
  daily:       'Auto Daily',
  weekly:      'Auto Weekly',
  pre_restore: 'Pre-Restore Safety',
};

export function BackupManager({ shopId, shopName }: Props) {
  const router = useRouter();
  const [backups, setBackups]   = useState<Backup[]>([]);
  const [logs, setLogs]         = useState<Log[]>([]);
  const [loading, setLoading]   = useState(true);
  const [pending, start]        = useTransition();
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [restoreId, setRestoreId]   = useState<string | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteErr, setDeleteErr]   = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/backup/list?shopId=${shopId}`);
    if (res.ok) {
      const d = await res.json();
      setBackups(d.backups ?? []);
      setLogs(d.logs ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = (label?: string) => {
    setMsg(''); setError('');
    start(async () => {
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, label: label || undefined, backupType: 'manual' }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg('✅ Backup created successfully!');
        await load();
        router.refresh();
      } else {
        setError(d.error ?? 'Backup failed');
      }
    });
  };

  const handleRestore = (id: string) => {
    setRestoreId(id);
    setConfirming(true);
  };

  const confirmRestore = () => {
    if (!restoreId) return;
    setConfirming(false);
    setMsg(''); setError('');
    start(async () => {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: restoreId, shopId }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg('✅ Backup restored! A pre-restore safety backup was created automatically.');
        setRestoreId(null);
        await load();
        router.refresh();
      } else {
        setError(d.error ?? 'Restore failed');
      }
    });
  };

  const handleDownload = (id: string) => {
    window.open(`/api/backup/download?id=${id}`, '_blank');
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setDeleteErr('');
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setDeleteErr('');
    start(async () => {
      const res = await fetch(`/api/backup/delete?id=${deleteId}&shopId=${shopId}`, { method: 'DELETE' });
      const d = await res.json();
      if (res.ok) {
        setBackups(prev => prev.filter(b => b.id !== deleteId));
        setDeleteId(null);
        setMsg('✅ Backup deleted.');
      } else {
        setDeleteErr(d.error ?? 'Delete failed');
      }
    });
  };

  const nonPreRestore = backups.filter(b => b.backup_type !== 'pre_restore');
  const latestBackup = nonPreRestore[0];

  return (
    <div className="space-y-5">
      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Delete Backup?</p>
                <p className="text-xs text-gray-400">This cannot be undone</p>
              </div>
            </div>
            {deleteErr && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{deleteErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteId(null); setDeleteErr(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Confirm Restore</p>
                <p className="text-xs text-gray-400">This will overwrite current data</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
              Restoring this backup will overwrite your current business data. A pre-restore safety backup will be created automatically before restoring.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirming(false); setRestoreId(null); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors"
              >Cancel</button>
              <button
                onClick={confirmRestore}
                disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {pending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Yes, Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <Archive size={16} className="text-emerald-400 mb-2" />
          <p className="text-2xl font-bold text-white">{nonPreRestore.length}</p>
          <p className="text-xs text-gray-400">Total backups</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <Clock size={16} className="text-purple-400 mb-2" />
          <p className="text-sm font-semibold text-white truncate">
            {latestBackup ? fmtDate(latestBackup.created_at).split(',')[0] : 'None yet'}
          </p>
          <p className="text-xs text-gray-400">Latest backup</p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-gray-800 bg-gray-800 p-4">
          <Shield size={16} className="text-blue-400 mb-2" />
          <p className="text-sm font-semibold text-white">5 max</p>
          <p className="text-xs text-gray-400">Retention policy</p>
        </div>
      </div>

      {/* Feedback */}
      {msg && <p className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-2.5 rounded-lg">{msg}</p>}
      {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2.5 rounded-lg">{error}</p>}

      {/* Create backup */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Create Manual Backup</p>
          <p className="text-xs text-gray-400 mt-0.5">Snapshot of all your business data right now. Max 5 kept.</p>
        </div>
        <button
          onClick={() => handleCreate()}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shrink-0 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {pending ? 'Creating…' : 'Backup Now'}
        </button>
      </div>

      {/* Backup history */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Backup History</h2>
          <span className="text-xs text-gray-500">{nonPreRestore.length} of 5 slots used</span>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-600" />
          </div>
        ) : nonPreRestore.length === 0 ? (
          <div className="py-12 text-center">
            <Archive size={28} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No backups yet</p>
            <p className="text-xs text-gray-600 mt-1">Click "Backup Now" to create your first backup.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {nonPreRestore.map(backup => (
              <div key={backup.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${TYPE_BADGE[backup.backup_type] ?? TYPE_BADGE.manual}`}>
                      {TYPE_LABEL[backup.backup_type] ?? backup.backup_type}
                    </span>
                    {backup.label && <span className="text-xs text-gray-400 truncate">{backup.label}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{fmtDate(backup.created_at)} · {fmtSize(backup.size_bytes)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDownload(backup.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleRestore(backup.id)}
                    disabled={pending}
                    className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                    title="Restore"
                  >
                    <RotateCcw size={14} />
                  </button>
                  {/* Only manual backups can be deleted */}
                  {backup.backup_type === 'manual' && (
                    <button
                      onClick={() => handleDelete(backup.id)}
                      disabled={pending}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      title="Delete (manual backups only)"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {['daily', 'weekly'].includes(backup.backup_type) && (
                    <div className="p-2" title="Auto backups are protected">
                      <Shield size={12} className="text-gray-700" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pre-restore backups */}
      {backups.some(b => b.backup_type === 'pre_restore') && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-700/50 flex items-center gap-2">
            <Shield size={13} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-400">Pre-Restore Safety Backups</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-500 ml-auto">Auto-created before every restore</span>
          </div>
          <div className="divide-y divide-gray-700/50">
            {backups.filter(b => b.backup_type === 'pre_restore').map(backup => (
              <div key={backup.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 truncate">{backup.label ?? 'Pre-restore safety'}</p>
                  <p className="text-xs text-gray-600">{fmtDate(backup.created_at)} · {fmtSize(backup.size_bytes)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => handleDownload(backup.id)} className="p-2 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Download">
                    <Download size={13} />
                  </button>
                  <button onClick={() => handleRestore(backup.id)} disabled={pending} className="p-2 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors" title="Restore">
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
          <button
            onClick={() => setShowLogs(v => !v)}
            className="w-full px-5 py-4 border-b border-gray-700 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
          >
            <span className="text-sm font-semibold text-white">Audit Log</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{logs.length} events</span>
              {showLogs ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
            </div>
          </button>
          {showLogs && (
            <div className="divide-y divide-gray-700 max-h-64 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <CheckCircle size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 capitalize">{log.action.replace(/_/g, ' ')}{log.notes ? ` — ${log.notes}` : ''}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">{fmtDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-600 bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3.5 space-y-1">
        <p>📋 <strong className="text-gray-500">Retention policy:</strong> 5 backups max. Oldest deleted automatically.</p>
        <p>🔄 <strong className="text-gray-500">Automatic backups:</strong> Daily and weekly backups run automatically and are protected.</p>
        <p>🗑️ <strong className="text-gray-500">Delete:</strong> Only manual backups can be deleted. Auto backups are locked.</p>
        <p>🛡️ <strong className="text-gray-500">Safety:</strong> A pre-restore backup is always created before any restore.</p>
      </div>
    </div>
  );
}
