'use client';

import { useState } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Location   = { id: string; name: string; address?: string; phone?: string; status: string; sort_order: number; };
type Schedule   = { id: string; doctor_id: string; location_id?: string; weekday: number; start_time: string; end_time: string; };
type SpecialDay = { id: string; doctor_id?: string; location_id?: string; date: string; type: string; note?: string; };
type Product    = { id: string; name: string; price?: number; metadata?: Record<string, any>; is_available: boolean; };
type DSLink     = { doctor_id: string; service_id: string; };
type DLLink     = { doctor_id: string; location_id: string; };

interface Props {
  shopId:      string;
  currency?:   string; // 'BDT' | 'USD'
  locations:   Location[];
  schedules:   Schedule[];
  specialDays: SpecialDay[];
  doctors:     Product[];
  services:    Product[];
  dsLinks:     DSLink[];
  dlLinks:     DLLink[];
}

type Tab = 'locations' | 'doctors' | 'services' | 'schedules' | 'off-days' | 'embed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'locations', label: 'Locations' },
  { id: 'doctors',   label: 'Doctors' },
  { id: 'services',  label: 'Services' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'off-days',  label: 'Off Days' },
  { id: 'embed',     label: 'Embed' },
];

export function SchedulingSettings({
  shopId,
  currency = 'BDT',
  locations: initLocs,
  schedules: initSched,
  specialDays: initSD,
  doctors: initDoctors,
  services: initServices,
  dsLinks: initDS,
  dlLinks: initDL,
}: Props) {
  const CUR = currency === 'USD' ? '$' : '৳';
  const [tab, setTab] = useState<Tab>('locations');

  const [locations,   setLocations]   = useState<Location[]>(initLocs);
  const [schedules,   setSchedules]   = useState<Schedule[]>(initSched);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>(initSD);
  const [doctors,     setDoctors]     = useState<Product[]>(initDoctors);
  const [services,    setServices]    = useState<Product[]>(initServices);
  const [dsLinks,     setDsLinks]     = useState<DSLink[]>(initDS);
  const [dlLinks,     setDlLinks]     = useState<DLLink[]>(initDL);

  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  const [newLoc,   setNewLoc]   = useState({ name: '', address: '', phone: '' });
  const [newDoc,   setNewDoc]   = useState({ name: '', specialization: '', department: '', fee: '', duration_min: '30' });
  const [newSvc,   setNewSvc]   = useState({ name: '', price: '', duration_min: '30' });
  const [newSched, setNewSched] = useState({ doctor_id: '', weekday: 1, start_time: '09:00', end_time: '17:00', location_id: '' });
  const [newSD,    setNewSD]    = useState({ doctor_id: '', date: '', type: 'off', note: '' });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // ── Location CRUD ──────────────────────────────────────────────
  async function addLocation() {
    if (!newLoc.name.trim()) return;
    setSaving(true);
    const r = await fetch('/api/scheduling/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLoc) });
    const d = await r.json();
    if (d.data) { setLocations(l => [...l, d.data]); setNewLoc({ name: '', address: '', phone: '' }); flash('Location added.'); }
    setSaving(false);
  }

  async function removeLocation(id: string) {
    await fetch(`/api/scheduling/locations/${id}`, { method: 'DELETE' });
    setLocations(l => l.filter(x => x.id !== id));
    setDlLinks(dl => dl.filter(x => x.location_id !== id));
    flash('Location removed.');
  }

  // ── Doctor CRUD ────────────────────────────────────────────────
  async function addDoctor() {
    if (!newDoc.name.trim()) return;
    setSaving(true);
    const r = await fetch('/api/scheduling/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDoc.name,
        product_type: 'doctor',
        metadata: {
          product_type:    'doctor',
          specialization:  newDoc.specialization || null,
          department:      newDoc.department || null,
          consultation_fee: newDoc.fee ? parseFloat(newDoc.fee) : null,
          duration_min:    parseInt(newDoc.duration_min) || 30,
        },
      }),
    });
    const d = await r.json();
    if (d.data) { setDoctors(ds => [...ds, d.data]); setNewDoc({ name: '', specialization: '', department: '', fee: '', duration_min: '30' }); flash('Doctor added.'); }
    setSaving(false);
  }

  async function removeDoctor(id: string) {
    await fetch('/api/scheduling/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    // Cascade: delete all schedules for this doctor so no orphaned "—" rows remain
    const orphans = schedules.filter(s => s.doctor_id === id);
    await Promise.all(orphans.map(s =>
      fetch('/api/scheduling/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) })
    ));
    setDoctors(ds => ds.filter(d => d.id !== id));
    setSchedules(s => s.filter(x => x.doctor_id !== id));
    setDsLinks(ds => ds.filter(x => x.doctor_id !== id));
    setDlLinks(dl => dl.filter(x => x.doctor_id !== id));
    flash('Doctor removed.');
  }

  // ── Service CRUD ───────────────────────────────────────────────
  async function addService() {
    if (!newSvc.name.trim()) return;
    setSaving(true);
    const r = await fetch('/api/scheduling/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newSvc.name,
        product_type: 'service',
        price: newSvc.price ? parseFloat(newSvc.price) : null,
        metadata: { product_type: 'service', duration_min: parseInt(newSvc.duration_min) || 30 },
      }),
    });
    const d = await r.json();
    if (d.data) { setServices(ss => [...ss, d.data]); setNewSvc({ name: '', price: '', duration_min: '30' }); flash('Service added.'); }
    setSaving(false);
  }

  async function removeService(id: string) {
    await fetch('/api/scheduling/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setServices(ss => ss.filter(s => s.id !== id));
    setDsLinks(ds => ds.filter(x => x.service_id !== id));
    flash('Service removed.');
  }

  // ── Schedule CRUD ──────────────────────────────────────────────
  async function addSchedule() {
    if (!newSched.doctor_id) return;
    setSaving(true);
    const r = await fetch('/api/scheduling/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSched) });
    const d = await r.json();
    if (d.data) { setSchedules(s => [...s, d.data]); flash('Schedule added.'); }
    setSaving(false);
  }

  async function removeSchedule(id: string) {
    await fetch('/api/scheduling/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSchedules(s => s.filter(x => x.id !== id));
    flash('Schedule removed.');
  }

  // ── Special Day CRUD ───────────────────────────────────────────
  async function addSpecialDay() {
    if (!newSD.date) return;
    setSaving(true);
    const r = await fetch('/api/scheduling/special-days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSD) });
    const d = await r.json();
    if (d.data) { setSpecialDays(s => [...s, d.data]); setNewSD({ doctor_id: '', date: '', type: 'off', note: '' }); flash('Off day added.'); }
    setSaving(false);
  }

  async function deleteSpecialDay(id: string) {
    await fetch('/api/scheduling/special-days', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSpecialDays(s => s.filter(x => x.id !== id));
  }

  // ── Assignment links ───────────────────────────────────────────
  async function toggleLink(type: 'dl' | 'ds', rowId: string, colId: string) {
    const key = `${rowId}:${colId}`;
    const body = type === 'dl'
      ? { type: 'doctor_location', doctor_id: rowId, location_id: colId }
      : { type: 'doctor_service',  doctor_id: rowId, service_id:  colId };
    const current = type === 'dl'
      ? dlLinks.some(x => `${x.doctor_id}:${x.location_id}` === key)
      : dsLinks.some(x => `${x.doctor_id}:${x.service_id}` === key);

    if (current) {
      await fetch('/api/scheduling/links', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (type === 'dl') setDlLinks(l => l.filter(x => `${x.doctor_id}:${x.location_id}` !== key));
      else               setDsLinks(l => l.filter(x => `${x.doctor_id}:${x.service_id}` !== key));
    } else {
      await fetch('/api/scheduling/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (type === 'dl') setDlLinks(l => [...l, { doctor_id: rowId, location_id: colId }]);
      else               setDsLinks(l => [...l, { doctor_id: rowId, service_id: colId }]);
    }
  }

  // ── Embed ──────────────────────────────────────────────────────
  const [embedColor, setEmbedColor] = useState('#10b981');
  const [embedTheme, setEmbedTheme] = useState<'dark' | 'light'>('dark');

  const PALETTE = [
    { label: 'Emerald', value: '#10b981' }, { label: 'Blue',   value: '#3b82f6' },
    { label: 'Purple',  value: '#7c3aed' }, { label: 'Red',    value: '#ef4444' },
    { label: 'Orange',  value: '#f97316' }, { label: 'Pink',   value: '#ec4899' },
    { label: 'Cyan',    value: '#06b6d4' }, { label: 'Yellow', value: '#eab308' },
    { label: 'Rose',    value: '#f43f5e' }, { label: 'Indigo', value: '#6366f1' },
  ];

  const appUrl  = typeof window !== 'undefined' ? window.location.origin : 'https://my.kothabot.ai.bd';
  const bookUrl = `${appUrl}/book/${shopId}?color=${encodeURIComponent(embedColor)}&theme=${embedTheme}`;
  const embedCode = `<iframe src="${bookUrl}" width="100%" height="750" frameborder="0" style="border-radius:12px;border:none;"></iframe>`;
  const jsCode    = `<script src="${appUrl}/embed.js" data-shop="${shopId}" data-book="1" data-book-color="${embedColor}" data-book-theme="${embedTheme}"></script>`;

  return (
    <div className="mt-4">
      {msg && (
        <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-700 rounded-xl text-sm text-emerald-300">{msg}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 border border-gray-800 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LOCATIONS ── */}
      {tab === 'locations' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="font-semibold mb-3 text-sm">Add Branch / Location</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder="Branch name *" value={newLoc.name}    onChange={e => setNewLoc(v => ({ ...v, name:    e.target.value }))} className={ic} />
              <input placeholder="Address"        value={newLoc.address} onChange={e => setNewLoc(v => ({ ...v, address: e.target.value }))} className={ic} />
              <input placeholder="Phone"          value={newLoc.phone}   onChange={e => setNewLoc(v => ({ ...v, phone:   e.target.value }))} className={ic} />
            </div>
            <button onClick={addLocation} disabled={saving || !newLoc.name.trim()} className={bc}>Add Location</button>
          </div>

          {locations.map(loc => (
            <div key={loc.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{loc.name}</p>
                {loc.address && <p className="text-xs text-gray-400">{loc.address}</p>}
              </div>
              <button onClick={() => removeLocation(loc.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
          ))}

          {/* Doctor → Location assignment matrix */}
          {doctors.length > 0 && locations.length > 0 && (
            <Matrix
              title="Doctor → Location"
              rows={doctors}
              cols={locations}
              links={dlLinks.map(x => `${x.doctor_id}:${x.location_id}`)}
              onToggle={(r, c) => toggleLink('dl', r, c)}
            />
          )}
        </div>
      )}

      {/* ── DOCTORS ── */}
      {tab === 'doctors' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="font-semibold mb-3 text-sm">Add Doctor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input placeholder="Doctor name *"      value={newDoc.name}           onChange={e => setNewDoc(v => ({ ...v, name:           e.target.value }))} className={ic} />
              <input placeholder="Specialization"     value={newDoc.specialization}  onChange={e => setNewDoc(v => ({ ...v, specialization:  e.target.value }))} className={ic} />
              <input placeholder="Department"         value={newDoc.department}      onChange={e => setNewDoc(v => ({ ...v, department:      e.target.value }))} className={ic} />
              <input placeholder={`Consultation fee ${CUR}`} value={newDoc.fee}             onChange={e => setNewDoc(v => ({ ...v, fee:             e.target.value }))} type="number" min="0" className={ic} />
              <input placeholder="Slot duration (min)" value={newDoc.duration_min}  onChange={e => setNewDoc(v => ({ ...v, duration_min:    e.target.value }))} type="number" min="5" step="5" className={ic} />
            </div>
            <button onClick={addDoctor} disabled={saving || !newDoc.name.trim()} className={bc}>Add Doctor</button>
          </div>

          {doctors.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No doctors yet. Add one above.</p>
          )}

          <div className="space-y-2">
            {doctors.map(d => {
              const m = d.metadata ?? {};
              return (
                <div key={d.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[m.specialization, m.department, m.consultation_fee ? `${CUR}${m.consultation_fee}` : '', `${m.duration_min ?? 30} min`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button onClick={() => removeDoctor(d.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              );
            })}
          </div>

          {/* Doctor → Service assignment matrix */}
          {doctors.length > 0 && services.length > 0 && (
            <Matrix
              title="Doctor → Service (which services each doctor offers)"
              rows={doctors}
              cols={services}
              links={dsLinks.map(x => `${x.doctor_id}:${x.service_id}`)}
              onToggle={(r, c) => toggleLink('ds', r, c)}
            />
          )}
          {doctors.length > 0 && services.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">Add services in the Services tab to assign them to doctors.</p>
          )}
        </div>
      )}

      {/* ── SERVICES ── */}
      {tab === 'services' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="font-semibold mb-3 text-sm">Add Service</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder="Service name *"   value={newSvc.name}         onChange={e => setNewSvc(v => ({ ...v, name:         e.target.value }))} className={ic} />
              <input placeholder={`Price ${CUR} (optional)`} value={newSvc.price}     onChange={e => setNewSvc(v => ({ ...v, price:        e.target.value }))} type="number" min="0" className={ic} />
              <input placeholder="Duration (min)"   value={newSvc.duration_min} onChange={e => setNewSvc(v => ({ ...v, duration_min: e.target.value }))} type="number" min="5" step="5" className={ic} />
            </div>
            <button onClick={addService} disabled={saving || !newSvc.name.trim()} className={bc}>Add Service</button>
          </div>

          {services.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No services yet. Add one above.</p>
          )}

          <div className="space-y-2">
            {services.map(s => {
              const m = s.metadata ?? {};
              return (
                <div key={s.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[s.price ? `${CUR}${s.price}` : '', `${m.duration_min ?? 30} min`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button onClick={() => removeService(s.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SCHEDULES ── */}
      {tab === 'schedules' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="font-semibold mb-3 text-sm">Add Working Hours</h3>
            {doctors.length === 0 && (
              <p className="text-xs text-yellow-400 mb-3">Add doctors first in the Doctors tab.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={newSched.doctor_id} onChange={e => setNewSched(v => ({ ...v, doctor_id: e.target.value }))} className={ic}>
                <option value="">— Select Doctor —</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={newSched.weekday} onChange={e => setNewSched(v => ({ ...v, weekday: parseInt(e.target.value) }))} className={ic}>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={newSched.start_time} onChange={e => setNewSched(v => ({ ...v, start_time: e.target.value }))} className={ic} />
              <input type="time" value={newSched.end_time}   onChange={e => setNewSched(v => ({ ...v, end_time:   e.target.value }))} className={ic} />
              <select value={newSched.location_id} onChange={e => setNewSched(v => ({ ...v, location_id: e.target.value }))} className={ic}>
                <option value="">Any location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <button onClick={addSchedule} disabled={saving || !newSched.doctor_id} className={bc}>Add Schedule</button>
          </div>

          {schedules.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No schedules yet.</p>
          )}

          <div className="space-y-2">
            {schedules.map((s, i) => {
              const doc = doctors.find(d => d.id === s.doctor_id);
              const loc = locations.find(l => l.id === s.location_id);
              return (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{doc?.name ?? '—'}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-300">{WEEKDAYS[s.weekday]}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-300">{s.start_time}–{s.end_time}</span>
                    {loc && <span className="text-gray-500 ml-2">@ {loc.name}</span>}
                  </div>
                  <button onClick={() => removeSchedule(s.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OFF DAYS ── */}
      {tab === 'off-days' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="font-semibold mb-3 text-sm">Add Off Day / Holiday</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="date" value={newSD.date} onChange={e => setNewSD(v => ({ ...v, date: e.target.value }))} className={ic} />
              <select value={newSD.type} onChange={e => setNewSD(v => ({ ...v, type: e.target.value }))} className={ic}>
                <option value="off">Full Day Off</option>
                <option value="holiday">Public Holiday</option>
              </select>
              <select value={newSD.doctor_id} onChange={e => setNewSD(v => ({ ...v, doctor_id: e.target.value }))} className={ic}>
                <option value="">All doctors</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input placeholder="Note (optional)" value={newSD.note} onChange={e => setNewSD(v => ({ ...v, note: e.target.value }))} className={ic} />
            </div>
            <button onClick={addSpecialDay} disabled={saving || !newSD.date} className={bc}>Add Off Day</button>
          </div>

          {specialDays.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No off days configured.</p>
          )}

          <div className="space-y-2">
            {specialDays.map(sd => {
              const doc = doctors.find(d => d.id === sd.doctor_id);
              return (
                <div key={sd.id} className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{sd.date}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-300 capitalize">{sd.type}</span>
                    {doc && <span className="text-gray-500 ml-2">({doc.name})</span>}
                    {!doc && <span className="text-gray-500 ml-2">(All doctors)</span>}
                    {sd.note && <span className="text-gray-500 ml-2">— {sd.note}</span>}
                  </div>
                  <button onClick={() => deleteSpecialDay(sd.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EMBED ── */}
      {tab === 'embed' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
            <h3 className="font-semibold text-sm">Booking Form Style</h3>
            <div>
              <p className="text-xs text-gray-400 mb-2">Primary colour</p>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map(c => (
                  <button key={c.value} title={c.label} onClick={() => setEmbedColor(c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${embedColor === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c.value }} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Selected: <span style={{ color: embedColor }}>{PALETTE.find(c => c.value === embedColor)?.label ?? embedColor}</span></p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Theme</p>
              <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
                {(['dark', 'light'] as const).map(t => (
                  <button key={t} onClick={() => setEmbedTheme(t)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${embedTheme === t ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                  </button>
                ))}
              </div>
            </div>
            <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-xs hover:underline break-all block">
              Preview → {bookUrl}
            </a>
          </div>
          <CodeBlock label="Iframe Embed" code={embedCode} />
          <CodeBlock label="JS Widget (floating Book button)" code={jsCode} />
        </div>
      )}
    </div>
  );
}

function Matrix({ title, rows, cols, links, onToggle }: {
  title: string;
  rows: { id: string; name: string }[];
  cols: { id: string; name: string }[];
  links: string[];
  onToggle: (rowId: string, colId: string) => void;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="font-semibold mb-3 text-sm">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-gray-400 pb-2 font-normal pr-4 min-w-32"></th>
              {cols.map(c => <th key={c.id} className="text-center text-gray-400 pb-2 font-normal px-3 text-xs">{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-t border-gray-800">
                <td className="py-2 text-white text-sm pr-4 whitespace-nowrap">{row.name}</td>
                {cols.map(col => (
                  <td key={col.id} className="text-center py-2">
                    <input
                      type="checkbox"
                      checked={links.includes(`${row.id}:${col.id}`)}
                      onChange={() => onToggle(row.id, col.id)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="font-semibold mb-1 text-sm">{label}</h3>
      <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap mt-2">{code}</pre>
      <button onClick={() => navigator.clipboard.writeText(code)} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">Copy</button>
    </div>
  );
}

const ic = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-emerald-500';
const bc = 'mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
