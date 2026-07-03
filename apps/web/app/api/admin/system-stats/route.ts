import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

const execAsync = promisify(exec);
const STATS_TOKEN = process.env.SYSTEM_STATS_TOKEN || '';

// The VPS this Next.js process itself runs on (all /proc readers below are
// local to whichever host runs the app — currently the OVH VPS).
const VPS_IP = process.env.VPS_PUBLIC_IP || '15.235.199.133';
const VPS_HOSTNAME = process.env.VPS_HOSTNAME || 'vps-d903e572.vps.ovh.ca';

// The 3 systemd-managed Node services on this VPS (see repo SERVERS.md).
// Was pm2 jlist before the Railway->VPS migration — this box uses systemd.
const SYSTEMD_SERVICES = ['kothabot-web', 'kothabot-bot-server', 'kothabot-voice-server'];

// Allow the standalone HTML monitor (hosted anywhere — typically cPanel) to
// poll this endpoint. Auth is via ?token=… so CORS can stay permissive.
function corsHeaders(req: NextRequest) {
  return {
    'Access-Control-Allow-Origin':  req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control':                'no-store',
  } as Record<string, string>;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// ── /proc readers ───────────────────────────────────────────────────────────
async function readCpu() {
  const txt = await fs.readFile('/proc/stat', 'utf8');
  const line = txt.split('\n')[0]!;                   // "cpu  user nice system idle iowait irq softirq steal ..."
  const parts = line.split(/\s+/).slice(1).map(Number);
  const idle  = parts[3]! + (parts[4] ?? 0);
  const total = parts.reduce((s, n) => s + n, 0);
  return { idle, total };
}

async function readMem() {
  const txt = await fs.readFile('/proc/meminfo', 'utf8');
  const get = (k: string) => Number(txt.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm'))?.[1] ?? 0);
  const totalKb     = get('MemTotal');
  const availableKb = get('MemAvailable');
  return {
    totalMb:     Math.round(totalKb     / 1024),
    usedMb:      Math.round((totalKb - availableKb) / 1024),
    availableMb: Math.round(availableKb / 1024),
    percentUsed: Math.round(((totalKb - availableKb) / totalKb) * 1000) / 10,
  };
}

async function readNet() {
  const txt = await fs.readFile('/proc/net/dev', 'utf8');
  let rxBytes = 0, txBytes = 0;
  for (const line of txt.split('\n').slice(2)) {
    const m = line.match(/^\s*([a-z0-9]+):\s+(\d+)(?:\s+\d+){7}\s+(\d+)/i);
    if (!m) continue;
    const iface = m[1]!;
    if (iface === 'lo') continue;
    rxBytes += Number(m[2]);
    txBytes += Number(m[3]);
  }
  return { rxBytes, txBytes };
}

async function readUptime() {
  const txt = await fs.readFile('/proc/uptime', 'utf8');
  return Math.round(Number(txt.split(/\s+/)[0]!));
}

async function readDisk() {
  // df reports human-friendly; use POSIX -kP for portability
  const { stdout } = await execAsync("df -kP / | tail -1");
  const cols = stdout.trim().split(/\s+/);
  const totalKb = Number(cols[1]);
  const usedKb  = Number(cols[2]);
  const availKb = Number(cols[3]);
  return {
    totalGb:     Math.round(totalKb / 1024 / 1024 * 10) / 10,
    usedGb:      Math.round(usedKb  / 1024 / 1024 * 10) / 10,
    availableGb: Math.round(availKb / 1024 / 1024 * 10) / 10,
    percentUsed: Math.round((usedKb / totalKb) * 1000) / 10,
  };
}

async function readLoad() {
  const txt = await fs.readFile('/proc/loadavg', 'utf8');
  const [l1, l5, l15] = txt.trim().split(/\s+/).map(Number);
  return { load1: l1 ?? 0, load5: l5 ?? 0, load15: l15 ?? 0 };
}

async function readServices() {
  const results = await Promise.all(
    SYSTEMD_SERVICES.map(async (name) => {
      try {
        const [activeRes, pidRes, memRes] = await Promise.all([
          execAsync(`systemctl is-active ${name}`).catch((e) => e),
          execAsync(`systemctl show ${name} --property=MainPID --value`),
          execAsync(`systemctl show ${name} --property=MemoryCurrent --value`),
        ]);
        const status = (activeRes.stdout ?? activeRes.toString()).trim();
        const pid = Number(pidRes.stdout.trim()) || 0;
        const memBytes = Number(memRes.stdout.trim());
        return {
          name,
          status: status === 'active' ? 'online' : status || 'unknown',
          pid,
          memoryMb: Number.isFinite(memBytes) && memBytes > 0 ? Math.round((memBytes / 1024 / 1024) * 10) / 10 : 0,
        };
      } catch {
        return { name, status: 'unknown', pid: 0, memoryMb: 0 };
      }
    })
  );
  return results;
}

async function readProxyStatus() {
  const botServerUrl = process.env.BOT_SERVER_URL;
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!botServerUrl || !secret) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${botServerUrl}/internal/proxy-status`, {
      headers: { 'x-internal-secret': secret },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Git / deploy log (best-effort — empty arrays if not a git checkout) ────
const GIT_CWD = process.env.GIT_CWD || '/var/www/kothabot-2.0';
async function readGit() {
  try {
    const opts = { cwd: GIT_CWD };
    const [headRaw, branchRaw, logRaw] = await Promise.all([
      execAsync('git log -1 --format=%H%x09%h%x09%aI%x09%an%x09%s', opts).then(r => r.stdout.trim()),
      execAsync('git rev-parse --abbrev-ref HEAD', opts).then(r => r.stdout.trim()),
      execAsync('git log -15 --format=%h%x09%aI%x09%an%x09%s', opts).then(r => r.stdout.trim()),
    ]);
    const [hash, short, date, author, subject] = headRaw.split('\t');
    const recent = logRaw.split('\n').filter(Boolean).map(line => {
      const [h, d, a, ...rest] = line.split('\t');
      return { hash: h, date: d, author: a, subject: rest.join('\t') };
    });
    return { branch: branchRaw, hash, short, date, author, subject, recent };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // Primary auth: normal admin dashboard session (cookie, same as every
  // other admin route). Fallback: ?token= for a hypothetical external
  // monitor — kept for compatibility, unused by the in-dashboard panel.
  const unauth = await requireAdminSession();
  if (unauth) {
    const url   = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!STATS_TOKEN || token !== STATS_TOKEN) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }
  }

  try {
    // CPU needs a delta sample — take two readings 200ms apart
    const cpu1 = await readCpu();
    const net1 = await readNet();
    await new Promise(r => setTimeout(r, 200));
    const cpu2 = await readCpu();
    const net2 = await readNet();

    const idleDiff  = cpu2.idle  - cpu1.idle;
    const totalDiff = cpu2.total - cpu1.total;
    const cpuPercent = totalDiff > 0
      ? Math.round((1 - idleDiff / totalDiff) * 1000) / 10
      : 0;

    // Network throughput in bytes/sec (extrapolated from 200ms window)
    const rxBps = Math.round((net2.rxBytes - net1.rxBytes) * 5);
    const txBps = Math.round((net2.txBytes - net1.txBytes) * 5);

    const [mem, disk, uptime, load, services, proxy, git] = await Promise.all([
      readMem(), readDisk(), readUptime(), readLoad(), readServices(), readProxyStatus(), readGit(),
    ]);

    return NextResponse.json({
      ts:     Date.now(),
      host:   { ip: VPS_IP, hostname: VPS_HOSTNAME },
      uptime,
      cpu:    { percentUsed: cpuPercent, load },
      memory: mem,
      disk,
      network: { rxBytesPerSec: rxBps, txBytesPerSec: txBps, rxBytesTotal: net2.rxBytes, txBytesTotal: net2.txBytes },
      services,
      proxy,
      git,
    }, { headers: corsHeaders(req) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'failed' }, { status: 500, headers: corsHeaders(req) });
  }
}
