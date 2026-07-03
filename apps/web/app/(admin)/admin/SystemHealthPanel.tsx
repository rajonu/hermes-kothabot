'use client';

import { useState, useEffect } from 'react';
import { Server, Cpu, HardDrive, Wifi, RefreshCw, Router } from 'lucide-react';

interface SystemStats {
  host: { ip: string; hostname: string };
  uptime: number;
  cpu: { percentUsed: number; load: { load1: number; load5: number; load15: number } };
  memory: { totalMb: number; usedMb: number; percentUsed: number };
  disk: { totalGb: number; usedGb: number; percentUsed: number };
  network: { rxBytesPerSec: number; txBytesPerSec: number };
  services: Array<{ name: string; status: string; pid: number; memoryMb: number }>;
  proxy: { configured: boolean; connected: boolean; latencyMs: number | null; error: string | null } | null;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / 1048576).toFixed(1)} MB/s`;
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
    </div>
  );
}

export function SystemHealthPanel() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-stats');
      if (!res.ok) {
        setError('System health unavailable (VPS only)');
        return;
      }
      setStats(await res.json());
      setError(null);
    } catch {
      setError('Could not reach system stats endpoint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Server size={14} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-white">System Health</h2>
        </div>
        <p className="text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Server size={14} className="text-gray-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-white">Loading system health…</h2>
        </div>
      </div>
    );
  }

  const cpuColor = stats.cpu.percentUsed > 80 ? '#ef4444' : stats.cpu.percentUsed > 50 ? '#f59e0b' : '#10b981';
  const memColor = stats.memory.percentUsed > 80 ? '#ef4444' : stats.memory.percentUsed > 50 ? '#f59e0b' : '#10b981';
  const diskColor = stats.disk.percentUsed > 80 ? '#ef4444' : stats.disk.percentUsed > 50 ? '#f59e0b' : '#10b981';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Server size={14} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">System Health</h2>
          <span className="text-[10px] text-gray-500">{stats.host.ip}</span>
          <span className="text-[10px] text-gray-600">·</span>
          <span className="text-[10px] text-gray-500">Uptime: {formatUptime(stats.uptime)}</span>
        </div>
        <button onClick={fetchStats} disabled={loading} className="text-gray-500 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU */}
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Cpu size={12} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400 uppercase">CPU</span>
          </div>
          <p className="text-lg font-bold text-white mb-1">{stats.cpu.percentUsed}%</p>
          <ProgressBar percent={stats.cpu.percentUsed} color={cpuColor} />
          <p className="text-[10px] text-gray-500 mt-1">Load: {stats.cpu.load.load1} / {stats.cpu.load.load5} / {stats.cpu.load.load15}</p>
        </div>

        {/* Memory */}
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Server size={12} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400 uppercase">Memory</span>
          </div>
          <p className="text-lg font-bold text-white mb-1">{stats.memory.percentUsed}%</p>
          <ProgressBar percent={stats.memory.percentUsed} color={memColor} />
          <p className="text-[10px] text-gray-500 mt-1">{stats.memory.usedMb} / {stats.memory.totalMb} MB</p>
        </div>

        {/* Disk */}
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <HardDrive size={12} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400 uppercase">Disk</span>
          </div>
          <p className="text-lg font-bold text-white mb-1">{stats.disk.percentUsed}%</p>
          <ProgressBar percent={stats.disk.percentUsed} color={diskColor} />
          <p className="text-[10px] text-gray-500 mt-1">{stats.disk.usedGb} / {stats.disk.totalGb} GB</p>
        </div>

        {/* Network */}
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wifi size={12} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400 uppercase">Network</span>
          </div>
          <div className="space-y-1">
            <div>
              <p className="text-[10px] text-gray-500">↓ In</p>
              <p className="text-sm font-bold text-white">{formatBytes(stats.network.rxBytesPerSec)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">↑ Out</p>
              <p className="text-sm font-bold text-white">{formatBytes(stats.network.txBytesPerSec)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services (systemd, on the VPS) */}
      {stats.services.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Services</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${svc.status === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-xs font-medium text-white">{svc.name}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className={svc.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>{svc.status}</span>
                  {svc.memoryMb > 0 && <span>{svc.memoryMb} MB</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raspberry Pi residential proxy (WhatsApp pairing chain) */}
      {stats.proxy && (
        <div className="mt-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Residential Proxy (Raspberry Pi)</p>
          <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
            <div className="flex items-center gap-2">
              <Router size={12} className="text-gray-400" />
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !stats.proxy.configured ? 'bg-gray-600' : stats.proxy.connected ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              <span className="text-xs font-medium text-white">
                {!stats.proxy.configured
                  ? 'Not configured'
                  : stats.proxy.connected
                  ? 'Connected'
                  : 'Disconnected'}
              </span>
            </div>
            <div className="text-[10px] text-gray-500">
              {stats.proxy.connected && stats.proxy.latencyMs != null && <span>{stats.proxy.latencyMs}ms</span>}
              {!stats.proxy.connected && stats.proxy.error && <span className="text-red-400">{stats.proxy.error}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
