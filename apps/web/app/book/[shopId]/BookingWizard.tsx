'use client';

import { useState, useEffect } from 'react';

type Step = 'location' | 'doctor' | 'service' | 'datetime' | 'patient' | 'confirm' | 'done';

interface Location  { id: string; name: string; address?: string; }
interface Doctor    { id: string; name: string; specialization?: string; fee?: number; duration_min: number; }
interface Service   { id: string; name: string; price?: number; duration_min: number; }
interface TimeSlot  { starts_at: string; ends_at: string; label: string; }

const STEPS: { id: Step; label: string }[] = [
  { id: 'location', label: 'Location' },
  { id: 'doctor',   label: 'Doctor' },
  { id: 'service',  label: 'Service' },
  { id: 'datetime', label: 'Date & Time' },
  { id: 'patient',  label: 'Your Info' },
  { id: 'confirm',  label: 'Confirm' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function BookingWizard({
  shopId, primaryColor, theme = 'dark',
}: {
  shopId: string; shopName: string; primaryColor: string; theme?: 'dark' | 'light';
}) {
  const dk = theme === 'dark';
  const [step, setStep]       = useState<Step>('location');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [locations, setLocations]   = useState<Location[]>([]);
  const [doctors,   setDoctors]     = useState<Doctor[]>([]);
  const [services,  setServices]    = useState<Service[]>([]);
  const [slots,     setSlots]       = useState<TimeSlot[]>([]);
  const [availDates, setAvailDates] = useState<Set<string>>(new Set());

  const [locationId, setLocationId] = useState('');
  const [doctorId,   setDoctorId]   = useState('');
  const [serviceId,  setServiceId]  = useState('');
  const [date,       setDate]       = useState('');
  const [slot,       setSlot]       = useState<TimeSlot | null>(null);
  const [patient, setPatient]       = useState({ name: '', phone: '', email: '' });
  const [confirmedId, setConfirmedId] = useState('');

  // Calendar state
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed

  const base = `/api/book/${shopId}`;

  // Cascading init: auto-skip any step where there's only one choice.
  // Location(1) → Doctor(1) → Service(1) → jump straight to calendar.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const d = await fetch(`${base}/options`).then(r => r.json());
      const locs: Location[] = d.locations ?? [];
      setLocations(locs);

      // ── Location ──
      let locId = '';
      if (locs.length <= 1) {
        locId = locs[0]?.id ?? 'all';
        setLocationId(locId);
      } else {
        setStep('location');
        setLoading(false);
        return;
      }

      // ── Doctor ──
      const d2 = await fetch(`${base}/options?location=${locId}`).then(r => r.json());
      const docs: Doctor[] = d2.doctors ?? [];
      setDoctors(docs);

      let docId = '';
      if (docs.length <= 1) {
        docId = docs[0]?.id ?? '';
        setDoctorId(docId);
      } else {
        setStep('doctor');
        setLoading(false);
        return;
      }

      // ── Service ──
      const d3 = docId
        ? await fetch(`${base}/options?doctor=${docId}`).then(r => r.json())
        : { services: [] };
      const svcs: Service[] = d3.services ?? [];
      setServices(svcs);

      let svcId = '';
      if (svcs.length <= 1) {
        svcId = svcs[0]?.id ?? '';
        setServiceId(svcId);
      } else {
        setStep('service');
        setLoading(false);
        return;
      }

      // Everything auto-selected — go straight to calendar
      if (docId && svcId) {
        await _loadAvailDates(docId, svcId, calYear, calMonth);
      }
      setStep('datetime');
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  async function loadDoctors(locId: string) {
    setLoading(true); setError('');
    const r = await fetch(`${base}/options?location=${locId}`);
    const d = await r.json();
    const docs: Doctor[] = d.doctors ?? [];
    setDoctors(docs);
    // Auto-skip doctor if only one
    if (docs.length <= 1) {
      const docId = docs[0]?.id ?? '';
      setDoctorId(docId);
      await loadServices(docId, true);
    } else {
      setStep('doctor');
      setLoading(false);
    }
  }

  async function loadServices(docId: string, autoSkipCheck = false) {
    if (!autoSkipCheck) { setLoading(true); setError(''); }
    const r = await fetch(`${base}/options?doctor=${docId}`);
    const d = await r.json();
    const svcs: Service[] = d.services ?? [];
    setServices(svcs);
    // Auto-skip service if only one
    if (autoSkipCheck && svcs.length <= 1) {
      const svcId = svcs[0]?.id ?? '';
      setServiceId(svcId);
      if (docId && svcId) await _loadAvailDates(docId, svcId, calYear, calMonth);
      setStep('datetime');
    } else {
      setStep('service');
    }
    setLoading(false);
  }

  async function _loadAvailDates(docId: string, svcId: string, year: number, month: number) {
    const mm = String(month + 1).padStart(2, '0');
    const r = await fetch(`${base}/available-dates?doctor=${docId}&service=${svcId}&month=${year}-${mm}`);
    if (!r.ok) { setAvailDates(new Set()); return; }
    const d = await r.json();
    setAvailDates(new Set(d.available ?? []));
  }

  async function loadSlots(docId: string, svcId: string, dt: string) {
    setLoading(true); setError('');
    const r = await fetch(
      `${base}/availability?doctor=${docId}&service=${svcId}&date=${dt}${locationId ? `&location=${locationId}` : ''}`
    );
    const d = await r.json();
    setSlots(d.slots ?? []);
    if (!d.slots?.length) setError('No available slots on this date.');
    setLoading(false);
  }

  async function submit() {
    setLoading(true); setError('');
    const r = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_id:   doctorId,
        service_id:  serviceId,
        location_id: locationId !== 'all' ? locationId : undefined,
        starts_at:   slot!.starts_at,
        patient:     { name: patient.name, phone: patient.phone, email: patient.email || undefined },
      }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? 'Booking failed.'); setLoading(false); return; }
    setConfirmedId(d.data.orderId);
    setStep('done');
    setLoading(false);
  }

  // Build calendar grid for current calYear/calMonth
  function buildCalendar() {
    const firstDay = new Date(calYear, calMonth, 1);
    // ISO week: Mon=0…Sun=6
    let startDow = firstDay.getDay(); // 0=Sun
    const isoStart = startDow === 0 ? 6 : startDow - 1; // shift to Mon=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < isoStart; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function dateStr(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isPast(day: number) {
    return new Date(dateStr(day)) < new Date(today.toISOString().slice(0, 10));
  }

  const selectedDoctor  = doctors.find(d => d.id === doctorId);
  const selectedService = services.find(s => s.id === serviceId);
  const selectedLoc     = locations.find(l => l.id === locationId);

  // Completed step set for sidebar indicator
  const completedSteps: Set<Step> = new Set();
  const stepOrder: Step[] = ['location','doctor','service','datetime','patient','confirm'];
  const curIdx = stepOrder.indexOf(step);
  stepOrder.slice(0, curIdx).forEach(s => completedSteps.add(s));

  const bg   = dk ? 'bg-gray-950 text-white'    : 'bg-white text-gray-900';
  const sbg  = dk ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200';
  const cbg  = dk ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';

  function Card({ items, onSelect, selected }: {
    items: { id: string; label: string; sub?: string }[];
    onSelect: (id: string) => void;
    selected?: string;
  }) {
    if (loading) return <p className={`text-sm py-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Loading…</p>;
    if (!items.length) return <p className={`text-sm py-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>None available.</p>;
    return (
      <div className="space-y-2">
        {items.map(item => (
          <button key={item.id} onClick={() => onSelect(item.id)}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${
              selected === item.id
                ? 'border-2'
                : dk ? 'border-gray-700 bg-gray-900 hover:border-gray-600' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            style={selected === item.id ? { borderColor: primaryColor, background: primaryColor + '18' } : {}}
          >
            <div className={`font-medium text-sm ${dk ? 'text-white' : 'text-gray-900'}`}>{item.label}</div>
            {item.sub && <div className={`text-xs mt-0.5 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>{item.sub}</div>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex rounded-2xl border overflow-hidden min-h-[520px] ${cbg}`}>

      {/* ── Sidebar ── */}
      {step !== 'done' && (
        <aside className={`hidden sm:flex flex-col w-52 shrink-0 border-r p-5 gap-1 ${sbg}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dk ? 'text-gray-500' : 'text-gray-400'}`}>Steps</p>
          {STEPS.map((s, i) => {
            const done = completedSteps.has(s.id);
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-2.5 py-1.5">
                <span
                  className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    done   ? 'text-white border-transparent'
                    : active ? 'border-2 text-white'
                    : dk ? 'border-gray-700 text-gray-600' : 'border-gray-300 text-gray-400'
                  }`}
                  style={done ? { background: primaryColor, borderColor: primaryColor }
                    : active ? { borderColor: primaryColor, color: primaryColor, background: 'transparent' }
                    : {}}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={`text-sm ${active ? 'font-semibold' : done ? '' : dk ? 'text-gray-500' : 'text-gray-400'}`}
                  style={active ? { color: primaryColor } : {}}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </aside>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 p-5 sm:p-7 overflow-y-auto">

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-700 rounded-xl text-sm text-red-300">{error}</div>
        )}

        {/* Location */}
        {step === 'location' && (
          <>
            <h2 className="text-lg font-semibold mb-1">Select Location</h2>
            <p className={`text-sm mb-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Choose the branch you'd like to visit.</p>
            <Card
              items={locations.map(l => ({ id: l.id, label: l.name, sub: l.address }))}
              onSelect={id => { setLocationId(id); loadDoctors(id); setStep('doctor'); }}
              selected={locationId}
            />
          </>
        )}

        {/* Doctor */}
        {step === 'doctor' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              {locations.length > 1 && (
                <button onClick={() => setStep('location')} className={`text-sm ${dk ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>← Back</button>
              )}
              <h2 className="text-lg font-semibold">Select Doctor</h2>
            </div>
            <p className={`text-sm mb-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Choose your preferred doctor.</p>
            <Card
              items={doctors.map(d => ({
                id: d.id, label: d.name,
                sub: [d.specialization, d.fee ? `${d.fee}` : '', `${d.duration_min} min`].filter(Boolean).join(' · '),
              }))}
              onSelect={id => { setDoctorId(id); loadServices(id); }}
              selected={doctorId}
            />
          </>
        )}

        {/* Service */}
        {step === 'service' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => setStep(doctors.length > 1 ? 'doctor' : 'location')} className={`text-sm ${dk ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>← Back</button>
              <h2 className="text-lg font-semibold">Select Service</h2>
            </div>
            <p className={`text-sm mb-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Choose the service you need.</p>
            <Card
              items={services.map(s => ({
                id: s.id, label: s.name,
                sub: [s.price ? String(s.price) : '', `${s.duration_min} min`].filter(Boolean).join(' · '),
              }))}
              onSelect={id => {
                setServiceId(id);
                setStep('datetime');
                _loadAvailDates(doctorId, id, calYear, calMonth);
              }}
              selected={serviceId}
            />
          </>
        )}

        {/* Date & Time — Amelia-style calendar */}
        {step === 'datetime' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setStep(services.length > 1 ? 'service' : doctors.length > 1 ? 'doctor' : 'location')} className={`text-sm ${dk ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>← Back</button>
              <h2 className="text-lg font-semibold">Select Date &amp; Time</h2>
            </div>
            {/* Month / Year selectors + nav arrows */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  const m = calMonth === 0 ? 11 : calMonth - 1;
                  const y = calMonth === 0 ? calYear - 1 : calYear;
                  setCalMonth(m); setCalYear(y);
                  _loadAvailDates(doctorId, serviceId, y, m);
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold transition-colors flex-shrink-0 ${dk ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white' : 'border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              >‹</button>
              <select
                value={calMonth}
                onChange={e => {
                  const m = parseInt(e.target.value);
                  setCalMonth(m);
                  _loadAvailDates(doctorId, serviceId, calYear, m);
                }}
                className={`flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border focus:outline-none ${dk ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                style={{ minWidth: '90px' }}
              >
                {MONTH_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
              </select>
              <select
                value={calYear}
                onChange={e => {
                  const y = parseInt(e.target.value);
                  setCalYear(y);
                  _loadAvailDates(doctorId, serviceId, y, calMonth);
                }}
                className={`w-28 text-sm px-3 py-2 rounded-lg border focus:outline-none flex-shrink-0 ${dk ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {[0,1,2].map(offset => {
                  const y = today.getFullYear() + offset;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <button
                onClick={() => {
                  const m = calMonth === 11 ? 0 : calMonth + 1;
                  const y = calMonth === 11 ? calYear + 1 : calYear;
                  setCalMonth(m); setCalYear(y);
                  _loadAvailDates(doctorId, serviceId, y, m);
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold transition-colors flex-shrink-0 ${dk ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white' : 'border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              >›</button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_SHORT.map(d => (
                <div key={d} className={`text-center text-xs py-1.5 font-semibold ${dk ? 'text-gray-500' : 'text-gray-400'}`}>{d}</div>
              ))}
            </div>

            {/* Day cells — Amelia style */}
            <div className="grid grid-cols-7 gap-1">
              {buildCalendar().map((day, i) => {
                if (!day) return <div key={i} />;
                const ds       = dateStr(day);
                const isToday  = ds === today.toISOString().slice(0, 10);
                const past     = isPast(day);
                const avail    = availDates.has(ds);
                const selected = date === ds;

                return (
                  <button
                    key={i}
                    disabled={past || !avail}
                    onClick={() => { setDate(ds); setSlot(null); setSlots([]); loadSlots(doctorId, serviceId, ds); }}
                    className={`relative flex flex-col items-center justify-center aspect-square rounded-lg text-sm font-medium transition-all
                      ${selected
                        ? 'text-white shadow-md'
                        : avail && !past
                          ? `border-2 ${dk ? 'border-gray-600 text-white hover:border-transparent' : 'border-gray-300 text-gray-800 hover:border-transparent'}`
                          : `${dk ? 'text-gray-700' : 'text-gray-300'} cursor-not-allowed`
                      }`}
                    style={
                      selected
                        ? { background: primaryColor, borderColor: primaryColor }
                        : avail && !past
                          ? undefined
                          : {}
                    }
                    onMouseEnter={e => {
                      if (!selected && avail && !past) {
                        (e.currentTarget as HTMLElement).style.background = primaryColor + '22';
                        (e.currentTarget as HTMLElement).style.borderColor = primaryColor;
                        (e.currentTarget as HTMLElement).style.color = dk ? '#fff' : primaryColor;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selected && avail && !past) {
                        (e.currentTarget as HTMLElement).style.background = '';
                        (e.currentTarget as HTMLElement).style.borderColor = '';
                        (e.currentTarget as HTMLElement).style.color = '';
                      }
                    }}
                  >
                    {day}
                    {isToday && (
                      <span
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: selected ? '#fff' : primaryColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Time slots */}
            {date && (
              <div className="mt-5">
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dk ? 'text-gray-500' : 'text-gray-400'}`}>
                  Available times
                </p>
                {loading && (
                  <div className={`flex gap-2 flex-wrap`}>
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className={`h-9 w-20 rounded-lg animate-pulse ${dk ? 'bg-gray-800' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                )}
                {!loading && slots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(s => {
                      const sel = slot?.starts_at === s.starts_at;
                      return (
                        <button
                          key={s.starts_at}
                          onClick={() => setSlot(s)}
                          className={`px-4 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                            sel ? 'text-white shadow-sm' : dk ? 'border-gray-700 text-white hover:border-transparent' : 'border-gray-300 text-gray-800 hover:border-transparent'
                          }`}
                          style={sel ? { background: primaryColor, borderColor: primaryColor } : {}}
                          onMouseEnter={e => {
                            if (!sel) {
                              (e.currentTarget as HTMLElement).style.background = primaryColor + '22';
                              (e.currentTarget as HTMLElement).style.borderColor = primaryColor;
                            }
                          }}
                          onMouseLeave={e => {
                            if (!sel) {
                              (e.currentTarget as HTMLElement).style.background = '';
                              (e.currentTarget as HTMLElement).style.borderColor = '';
                            }
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!loading && !slots.length && (
                  <p className={`text-sm ${dk ? 'text-gray-500' : 'text-gray-400'}`}>No slots on this date — pick another day.</p>
                )}
              </div>
            )}

            {/* Summary + Continue */}
            <div className={`mt-5 pt-4 border-t flex items-center justify-between ${dk ? 'border-gray-800' : 'border-gray-100'}`}>
              <p className={`text-sm ${dk ? 'text-gray-400' : 'text-gray-500'}`}>
                {slot
                  ? `${MONTH_NAMES[parseInt(date.split('-')[1])-1]} ${parseInt(date.split('-')[2])}, ${date.split('-')[0]} — ${slot.label}`
                  : date
                    ? `${MONTH_NAMES[parseInt(date.split('-')[1])-1]} ${parseInt(date.split('-')[2])}, ${date.split('-')[0]} — pick a time`
                    : 'Select a date'}
              </p>
              {slot && (
                <button
                  onClick={() => setStep('patient')}
                  className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm shadow-sm"
                  style={{ background: primaryColor }}
                >
                  Continue
                </button>
              )}
            </div>
          </>
        )}

        {/* Patient info */}
        {step === 'patient' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => setStep('datetime')} className={`text-sm ${dk ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>← Back</button>
              <h2 className="text-lg font-semibold">Your Information</h2>
            </div>
            <p className={`text-sm mb-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>We'll use this to confirm your appointment.</p>
            <div className="space-y-3">
              <input
                placeholder="Full Name *"
                value={patient.name}
                onChange={e => setPatient(p => ({ ...p, name: e.target.value }))}
                className={ic(dk)}
              />
              <input
                placeholder="Phone Number *"
                value={patient.phone}
                onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
                className={ic(dk)}
              />
              <input
                placeholder="Email (optional)"
                value={patient.email}
                onChange={e => setPatient(p => ({ ...p, email: e.target.value }))}
                className={ic(dk)}
              />
            </div>
            <button
              onClick={() => setStep('confirm')}
              disabled={!patient.name || !patient.phone}
              className="mt-5 w-full py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
              style={{ background: primaryColor }}
            >
              Review Booking →
            </button>
          </>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <>
            <h2 className="text-lg font-semibold mb-1">Confirm Appointment</h2>
            <p className={`text-sm mb-4 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Please review the details before confirming.</p>
            <div className={`rounded-xl p-4 space-y-2 text-sm mb-5 border ${dk ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              {selectedLoc     && <Row label="Location" value={selectedLoc.name}    dk={dk} />}
              {selectedDoctor  && <Row label="Doctor"   value={selectedDoctor.name}  dk={dk} />}
              {selectedService && <Row label="Service"  value={selectedService.name} dk={dk} />}
              <Row label="Date"    value={date}              dk={dk} />
              <Row label="Time"    value={slot?.label ?? ''}  dk={dk} />
              <div className={`border-t ${dk ? 'border-gray-700' : 'border-gray-200'} pt-2`}>
                <Row label="Name"  value={patient.name}  dk={dk} />
                <Row label="Phone" value={patient.phone} dk={dk} />
                {patient.email && <Row label="Email" value={patient.email} dk={dk} />}
              </div>
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
              style={{ background: primaryColor }}
            >
              {loading ? 'Booking…' : 'Confirm Appointment'}
            </button>
            <button onClick={() => setStep('patient')} className={`mt-3 w-full text-sm text-center ${dk ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              ← Edit Details
            </button>
          </>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: primaryColor + '22', border: `2px solid ${primaryColor}` }}>
              ✓
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>Appointment Confirmed!</h2>
            <p className={`text-sm mb-1 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>
              Reference: <span className="font-mono text-xs">{confirmedId.slice(0, 8)}</span>
            </p>
            <p className={`text-sm ${dk ? 'text-gray-400' : 'text-gray-500'}`}>
              {selectedDoctor?.name} · {slot?.label} · {date}
            </p>
            <button
              onClick={() => {
                setStep('location'); setLocationId(''); setDoctorId(''); setServiceId('');
                setDate(''); setSlot(null); setPatient({ name: '', phone: '', email: '' });
                setDoctors([]); setServices([]); setSlots([]); setAvailDates(new Set());
              }}
              className="mt-8 text-sm hover:underline"
              style={{ color: primaryColor }}
            >
              Book another appointment
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function Row({ label, value, dk = true }: { label: string; value: string; dk?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={dk ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
      <span className={`font-medium ${dk ? 'text-white' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

const ic = (dk: boolean) => `w-full border rounded-xl px-4 py-3 text-sm focus:outline-none ${dk ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400'}`;
