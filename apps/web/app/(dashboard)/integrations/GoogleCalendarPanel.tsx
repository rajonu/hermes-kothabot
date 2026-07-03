'use client';

import { useState, useEffect } from 'react';

interface CalendarStatus {
  connected: boolean;
  email?: string;
  calendar_id?: string;
  connected_at?: string;
  last_sync_at?: string;
  last_error?: string | null;
  settings?: { auto_sync: boolean; sync_updates: boolean; sync_cancels: boolean };
  stats?: { events_created: number; events_updated: number; events_cancelled: number; sync_errors: number };
}

export function GoogleCalendarPanel() {
  const [status, setStatus]     = useState<CalendarStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; link?: string } | null>(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    setLoading(true);
    const res = await fetch('/api/calendar/status');
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }

  async function disconnect() {
    if (!confirm('Disconnect Google Calendar? Future appointments will not be synced.')) return;
    await fetch('/api/calendar/disconnect', { method: 'POST' });
    setStatus({ connected: false });
    setTestResult(null);
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch('/api/calendar/test', { method: 'POST' });
    const data = await res.json();
    if (res.ok) setTestResult({ ok: true, message: data.message, link: data.event_link });
    else setTestResult({ ok: false, message: data.error ?? 'Test failed' });
    setTesting(false);
    await loadStatus(); // refresh to show updated error state
  }

  async function saveSetting(key: string, value: boolean) {
    setSaving(true);
    await fetch('/api/calendar/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    setStatus(prev => prev ? { ...prev, settings: { ...prev.settings!, [key]: value } } : prev);
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 text-sm py-4">Loading calendar status…</div>;

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div className={`rounded-2xl border p-5 ${status?.connected ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-gray-900 border-gray-800'}`}>
        <div className="flex items-start gap-4">
          {/* Google Calendar icon */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#dadce0"/>
              <path d="M3 8h18" stroke="#dadce0"/>
              <rect x="8" y="2" width="2" height="4" rx="1" fill="#1a73e8"/>
              <rect x="14" y="2" width="2" height="4" rx="1" fill="#1a73e8"/>
              <path d="M8 13h8M8 17h5" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="17" cy="17" r="4" fill="#34a853"/>
              <path d="M15.5 17l1 1 2-2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-white">Google Calendar</h3>
              {status?.connected ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">CONNECTED</span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">NOT CONNECTED</span>
              )}
            </div>

            {status?.connected ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Signed in as <span className="text-white font-medium">{status.email}</span></p>
                {status.last_sync_at && (
                  <p className="text-xs text-gray-500">Last sync: {new Date(status.last_sync_at).toLocaleString()}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Connect your Google Calendar to automatically sync appointments and bookings.</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {status?.connected ? (
              <>
                <button
                  onClick={runTest}
                  disabled={testing}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg border border-gray-700 disabled:opacity-50"
                >
                  {testing ? '…' : '🧪 Test Sync'}
                </button>
                <button
                  onClick={disconnect}
                  className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-lg border border-red-800/50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <a
                href="/api/calendar/connect"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2"
              >
                <svg viewBox="0 0 18 18" className="w-4 h-4" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Connect Google Calendar
              </a>
            )}
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-4 rounded-xl p-3 text-xs ${testResult.ok ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300' : 'bg-red-900/30 border border-red-700/40 text-red-300'}`}>
            {testResult.ok ? '✅' : '❌'} {testResult.message}
            {testResult.link && (
              <a href={testResult.link} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
                View in Google Calendar →
              </a>
            )}
          </div>
        )}

        {/* Sync error warning */}
        {status?.connected && status.last_error && (
          <div className="mt-4 rounded-xl p-3 bg-red-900/20 border border-red-700/40">
            <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Auto-sync is failing</p>
            <p className="text-xs text-red-300/80 font-mono break-all">{status.last_error}</p>
            <p className="text-xs text-gray-400 mt-2">
              This usually means the Google authorization has expired. <strong className="text-white">Disconnect and reconnect</strong> Google Calendar to fix it.
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      {status?.connected && status.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Events Created',   value: status.stats.events_created,   color: 'text-emerald-400' },
            { label: 'Events Updated',   value: status.stats.events_updated,   color: 'text-blue-400' },
            { label: 'Cancellations',    value: status.stats.events_cancelled, color: 'text-amber-400' },
            { label: 'Sync Errors',      value: status.stats.sync_errors,      color: status.stats.sync_errors > 0 ? 'text-red-400' : 'text-gray-500' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sync settings */}
      {status?.connected && status.settings && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Sync Settings</h4>
          <div className="space-y-4">
            {[
              { key: 'auto_sync',    label: 'Auto-sync new appointments', desc: 'Automatically create a calendar event when an appointment is booked' },
              { key: 'sync_updates', label: 'Sync appointment updates',   desc: 'Update the calendar event when an appointment is modified' },
              { key: 'sync_cancels', label: 'Sync cancellations',         desc: 'Remove the calendar event when an appointment is cancelled' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={(status.settings as any)[key]}
                    onChange={e => saveSetting(key, e.target.checked)}
                    disabled={saving}
                  />
                  <div
                    className={`w-10 h-5 rounded-full transition-colors ${(status.settings as any)[key] ? 'bg-emerald-600' : 'bg-gray-700'}`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(status.settings as any)[key] ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-white font-medium group-hover:text-emerald-300 transition-colors">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* What gets synced */}
      {!status?.connected && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h4 className="text-sm font-semibold text-white mb-3">What gets synced automatically</h4>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {[
              { cat: '🏥 Clinic',        event: 'Patient appointments → Doctor + time + notes' },
              { cat: '💇 Salon',          event: 'Client bookings → Service + stylist + time' },
              { cat: '🍽 Restaurant',     event: 'Table reservations → Party size + time' },
              { cat: '🏠 Real Estate',    event: 'Property visits → Lead + property + time' },
              { cat: '🎓 Education',      event: 'Admission meetings → Course + instructor' },
              { cat: '🔧 Services',       event: 'Service visits → Service + booking time' },
              { cat: '🎨 Agency',         event: 'Consultations → Project + client + time' },
              { cat: '📦 Other',          event: 'Any booking-type order' },
            ].map(r => (
              <div key={r.cat} className="flex gap-2">
                <span className="font-medium text-gray-300 flex-shrink-0 w-28">{r.cat}</span>
                <span className="text-gray-500">{r.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
