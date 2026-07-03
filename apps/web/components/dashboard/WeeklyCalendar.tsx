'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, Upload, Calendar, X, Phone, User, Stethoscope, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Appointment {
  id: string;
  status: string;
  items: any;
  notes: string | null;
  created_at?: string;
  customers: { name: string; phone?: string | null } | null;
}

interface Props {
  appointments: Appointment[];
  customersLabel: string;
}

function parseApptDate(appt: Appointment): Date | null {
  const item = Array.isArray(appt.items) ? appt.items[0] : null;
  const raw = item?.appointment_at ?? item?.booking_at;
  if (raw) {
    const d = new Date(raw);
    // Only use if year is reasonable (2024+)
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2024) return d;
  }
  const match = appt.notes?.match(/Appointment:\s*([^\s|]+)/i);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2024) return d;
  }
  // Fallback: use created_at date (appointment was booked today)
  if (appt.created_at) {
    const d = new Date(appt.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function getPhone(appt: Appointment): string {
  if (appt.customers?.phone) return appt.customers.phone;
  const match = appt.notes?.match(/Phone:\s*([^|]+)/i);
  return match ? match[1].trim() : '';
}

function getDoctor(appt: Appointment): string {
  const item = Array.isArray(appt.items) ? appt.items[0] : null;
  if (item?.doctor_name) return item.doctor_name;
  if (item?.name && item.name !== 'Appointment') return item.name;
  const match = appt.notes?.match(/Doctor:\s*([^|]+)/i);
  return match ? match[1].trim() : '';
}

const STATUS_COLOR: { [k: string]: string } = {
  pending:   'bg-amber-500/25 border-l-2 border-amber-400 text-amber-200',
  confirmed: 'bg-emerald-500/25 border-l-2 border-emerald-400 text-emerald-200',
  completed: 'bg-gray-600/30 border-l-2 border-gray-500 text-gray-400',
  cancelled: 'bg-red-500/15 border-l-2 border-red-400 text-red-300',
};

const DOT_COLOR: { [k: string]: string } = {
  pending: 'bg-amber-400', confirmed: 'bg-emerald-400',
  completed: 'bg-gray-500', cancelled: 'bg-red-400',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Export helpers ──────────────────────────────────────────────────────────
function toCSV(appointments: Appointment[], customersLabel: string): string {
  const rows = [['ID', customersLabel.replace(/s$/, ''), 'Doctor', 'Date', 'Time', 'Status']];
  for (const a of appointments) {
    const d = parseApptDate(a);
    rows.push([
      a.id.slice(0, 8),
      a.customers?.name ?? '',
      getDoctor(a),
      d ? d.toLocaleDateString('en-CA') : '',
      d ? d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      a.status,
    ]);
  }
  return rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
}

function toICS(appointments: Appointment[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KothaBot//Appointments//EN'];
  for (const a of appointments) {
    const d = parseApptDate(a);
    if (!d) continue;
    const fmt = (dt: Date) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(d.getTime() + 30 * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@kothabot`,
      `DTSTART:${fmt(d)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${a.customers?.name ?? 'Appointment'} — ${getDoctor(a)}`,
      `STATUS:${a.status.toUpperCase()}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function WeeklyCalendar({ appointments, customersLabel }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<{ appt: Appointment; date: Date } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); return d;
  });

  const monthYear = days[0].toLocaleDateString('en', { month: 'short', year: 'numeric' });

  // Map appointment to day index
  const byDay: { appt: Appointment; date: Date }[][] = Array.from({ length: 7 }, () => []);
  for (const appt of appointments) {
    const d = parseApptDate(appt);
    if (!d) continue;
    const idx = days.findIndex(day =>
      day.getFullYear() === d.getFullYear() && day.getMonth() === d.getMonth() && day.getDate() === d.getDate()
    );
    if (idx >= 0) byDay[idx].push({ appt, date: d });
  }
  // Sort each day by time
  byDay.forEach(arr => arr.sort((a, b) => a.date.getTime() - b.date.getTime()));

  const total = byDay.reduce((s, a) => s + a.length, 0);

  const handleExportCSV = () => downloadFile(toCSV(appointments, customersLabel), 'appointments.csv', 'text/csv');
  const handleExportICS = () => downloadFile(toICS(appointments), 'appointments.ics', 'text/calendar');
  const handleImport    = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert(`Import of "${file.name}" noted — manual import via the Appointments page is coming soon.`);
    e.target.value = '';
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-emerald-400 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-white">{monthYear}</span>
            <span className="text-xs text-gray-500 ml-2">{total} appointment{total !== 1 ? 's' : ''} this week</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Export / Import */}
          <button onClick={handleExportCSV} title="Export CSV" className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors">
            <Download size={12} /> CSV
          </button>
          <button onClick={handleExportICS} title="Export Calendar" className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors">
            <Download size={12} /> .ics
          </button>
          <button onClick={() => fileRef.current?.click()} title="Import" className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors">
            <Upload size={12} /> Import
          </button>
          <input ref={fileRef} type="file" accept=".csv,.ics" onChange={handleImport} className="hidden" />

          {/* Week nav */}
          <div className="flex items-center gap-1 ml-1">
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 transition-colors">
                Today
              </button>
            )}
            <button onClick={() => setWeekOffset(o => o - 1)} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center border border-gray-700">
              <ChevronLeft size={13} className="text-gray-400" />
            </button>
            <button onClick={() => setWeekOffset(o => o + 1)} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center border border-gray-700">
              <ChevronRight size={13} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid — horizontal 7-col on desktop, scrollable on mobile */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {days.map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const isPast  = day < today && !isToday;
              const count   = byDay[i].length;
              return (
                <div key={i} className={`text-center py-2.5 px-1 ${isPast ? 'opacity-40' : ''}`}>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{DAYS[i]}</p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1 text-sm font-bold ${
                    isToday ? 'bg-emerald-500 text-black' : 'text-gray-300'
                  }`}>
                    {day.getDate()}
                  </div>
                  {count > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                        <div key={j} className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[byDay[i][j]?.appt.status] ?? 'bg-gray-500'}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Appointment columns */}
          <div className="grid grid-cols-7 divide-x divide-gray-800/60 min-h-[140px]">
            {days.map((day, i) => {
              const isPast = day < today && day.toDateString() !== new Date().toDateString();
              const slots  = byDay[i];
              return (
                <div key={i} className={`p-1.5 space-y-1 ${isPast ? 'opacity-40' : ''}`}>
                  {slots.length === 0 ? (
                    <div className="h-full min-h-[80px] rounded-lg border border-dashed border-gray-800/60" />
                  ) : (
                    slots.map(({ appt, date }) => {
                      const time    = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
                      const doctor  = getDoctor(appt);
                      // Patient: try customers join, then notes Name field
                      const noteNameMatch = appt.notes?.match(/Name:\s*([^|]+)/i);
                      const patient = appt.customers?.name ?? noteNameMatch?.[1]?.trim() ?? 'Appointment';
                      const phone   = getPhone(appt);
                      const style   = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
                      return (
                        <button
                          key={appt.id}
                          onClick={() => setSelected({ appt, date })}
                          className={`w-full text-left rounded-md px-2 py-1.5 text-[10px] leading-snug hover:brightness-110 transition-all cursor-pointer ${style}`}
                        >
                          <p className="font-bold">{time}</p>
                          {patient && <p className="truncate opacity-90">{patient}</p>}
                          {phone   && <p className="truncate opacity-70 text-[9px]">📞 {phone}</p>}
                          {doctor  && <p className="truncate opacity-60 text-[9px]">{doctor}</p>}
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Appointment detail popup */}
      {selected && (() => {
        const { appt, date } = selected;
        const doctor  = getDoctor(appt);
        const patient = appt.customers?.name ?? '';
        const phone   = getPhone(appt);
        const time    = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateStr = date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const style   = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
        return (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(85vh - 64px)' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className={`px-5 py-4 border-l-4 ${style} bg-gray-800/50 flex items-start justify-between gap-3`}>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Appointment</p>
                  <p className="text-sm font-bold text-white mt-0.5 capitalize">{appt.status}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white transition-colors mt-0.5">
                  <X size={16} />
                </button>
              </div>

              {/* Details — scrollable if content overflows */}
              <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
                <div className="flex items-center gap-3">
                  <Clock size={14} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{dateStr}</p>
                    <p className="text-sm font-semibold text-white">{time}</p>
                  </div>
                </div>

                {patient && (
                  <div className="flex items-center gap-3">
                    <User size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-sm text-white">{patient}</p>
                  </div>
                )}

                {phone && (
                  <div className="flex items-center gap-3">
                    <Phone size={14} className="text-emerald-400 shrink-0" />
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                      {phone}
                    </a>
                    <a href={`tel:${phone.replace(/\s/g, '')}`}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">
                      <Phone size={12} /> Call Now
                    </a>
                  </div>
                )}

                {doctor && (
                  <div className="flex items-center gap-3">
                    <Stethoscope size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-sm text-white">{doctor}</p>
                  </div>
                )}
              </div>

              {/* Actions — always at bottom, safe area for mobile nav */}
              <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-gray-800 bg-gray-900 shrink-0">
                <Link href={`/orders/${appt.id}`} onClick={() => setSelected(null)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-white transition-colors border border-gray-700">
                  <ExternalLink size={14} /> Full Details
                </Link>
                {phone && (
                  <a href={`tel:${phone.replace(/\s/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-black transition-colors">
                    <Phone size={14} /> Call {customersLabel.replace(/s$/, '')}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-800 bg-gray-950/40">
        {(['pending', 'confirmed', 'completed'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${DOT_COLOR[s]}`} />
            <span className="text-[10px] text-gray-500 capitalize">{s === 'completed' ? 'Done' : s}</span>
          </div>
        ))}
        <span className="text-[10px] text-gray-600 ml-auto hidden sm:block">← scroll on mobile</span>
      </div>
    </div>
  );
}
