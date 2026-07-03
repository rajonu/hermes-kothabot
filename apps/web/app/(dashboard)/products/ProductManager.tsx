'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Package, Search } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  sku?: string;
  stock_qty?: number;
  unit?: string;
  is_available: boolean;
  metadata: Record<string, any>;
}

interface CategoryConfig {
  emoji: string;
  title: string;
  itemLabel: string;
  categories: string[];
  extraFields: string[];
}

interface Props {
  shopId: string;
  shopCategory: string;
  cfg: CategoryConfig;
  currency?: string; // 'BDT' | 'USD'
  initialProducts: Product[];
}

export function ProductManager({ shopId, shopCategory, cfg, currency = 'BDT', initialProducts }: Props) {
  const CURRENCY = currency === 'USD' ? '$' : '৳';
  const router                      = useRouter();
  const [products, setProducts]     = useState<Product[]>(initialProducts);
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState<Product | null>(null);
  const [pending, start]            = useTransition();
  const [deletingId, setDel]        = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: cfg.categories[0] ?? '',
    sku: '', stock_qty: '', unit: 'piece',
    spicy: false, veg: false, generic: '', prescription: false,
    schedule: '', duration: '',
    location: '', bedrooms: '', bathrooms: '', area_size: '',
    instructor: '', delivery_time: '',
    sample_type: '', turnaround_time: '', preparation: '', report_format: '',
  });

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', category: cfg.categories[0] ?? '',
      sku: '', stock_qty: '', unit: 'piece',
      spicy: false, veg: false, generic: '', prescription: false,
      schedule: '', duration: '',
      location: '', bedrooms: '', bathrooms: '', area_size: '',
      instructor: '', delivery_time: '',
      sample_type: '', turnaround_time: '', preparation: '', report_format: '' });
    setEditItem(null);
    setShowForm(false);
  };

  const openEdit = (p: Product) => {
    setEditItem(p);
    setForm({
      name: p.name,
      description: p.description ?? '',
      price: p.price?.toString() ?? '',
      category: p.category ?? cfg.categories[0] ?? '',
      sku: p.sku ?? '',
      stock_qty: p.stock_qty?.toString() ?? '',
      unit: p.unit ?? 'piece',
      spicy: p.metadata?.spicy ?? false,
      veg: p.metadata?.veg ?? false,
      generic: p.metadata?.generic_name ?? '',
      prescription: p.metadata?.requires_prescription ?? false,
      schedule: p.metadata?.schedule ?? '',
      duration: p.metadata?.duration_min?.toString() ?? '',
      location: p.metadata?.location ?? '',
      bedrooms: p.metadata?.bedrooms?.toString() ?? '',
      bathrooms: p.metadata?.bathrooms?.toString() ?? '',
      area_size: p.metadata?.area_size ?? '',
      instructor: p.metadata?.instructor ?? '',
      delivery_time: p.metadata?.delivery_time ?? '',
      sample_type: p.metadata?.sample_type ?? '',
      turnaround_time: p.metadata?.turnaround_time ?? '',
      preparation: p.metadata?.preparation ?? '',
      report_format: p.metadata?.report_format ?? '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    start(async () => {
      const metadata: Record<string, any> = {};
      // Tag clinic test products so AI training data can distinguish them from doctors
      if (shopCategory === 'clinic') metadata.product_type = 'test';
      if (cfg.extraFields.includes('spicy')) { metadata.spicy = form.spicy; metadata.veg = form.veg; }
      if (cfg.extraFields.includes('generic')) { metadata.generic_name = form.generic; metadata.requires_prescription = form.prescription; }
      if (cfg.extraFields.includes('schedule')) metadata.schedule = form.schedule;
      if (cfg.extraFields.includes('duration')) metadata.duration_min = form.duration ? parseInt(form.duration) : null;
      if (cfg.extraFields.includes('location')) metadata.location = form.location;
      if (cfg.extraFields.includes('bedrooms')) metadata.bedrooms = form.bedrooms ? parseInt(form.bedrooms) : null;
      if (cfg.extraFields.includes('bathrooms')) metadata.bathrooms = form.bathrooms ? parseInt(form.bathrooms) : null;
      if (cfg.extraFields.includes('area_size')) metadata.area_size = form.area_size;
      if (cfg.extraFields.includes('instructor')) metadata.instructor = form.instructor;
      if (cfg.extraFields.includes('delivery_time')) metadata.delivery_time = form.delivery_time;
      if (cfg.extraFields.includes('sample_type')) metadata.sample_type = form.sample_type;
      if (cfg.extraFields.includes('turnaround_time')) metadata.turnaround_time = form.turnaround_time;
      if (cfg.extraFields.includes('preparation')) metadata.preparation = form.preparation;
      if (cfg.extraFields.includes('report_format')) metadata.report_format = form.report_format;

      const body = {
        shopId,
        id: editItem?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: form.price ? parseFloat(form.price) : null,
        category: form.category || null,
        sku: form.sku.trim() || null,
        stock_qty: form.stock_qty ? parseInt(form.stock_qty) : null,
        unit: cfg.extraFields.includes('unit') ? form.unit : null,
        metadata,
      };

      const res = await fetch('/api/products', {
        method: editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (editItem) {
          setProducts(prev => prev.map(p => p.id === editItem.id ? data.product : p));
        } else {
          setProducts(prev => [data.product, ...prev]);
        }
        resetForm();
        router.refresh();
      }
    });
  };

  const handleToggle = (id: string, current: boolean) => {
    start(async () => {
      await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_available: !current }),
      });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available: !current } : p));
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this item?')) return;
    setDel(id);
    start(async () => {
      await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== id));
      setDel(null);
    });
  };

  // Filter
  const filtered = products.filter(p => {
    const matchCat = filterCat === 'all' || p.category === filterCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const availableCount = products.filter(p => p.is_available).length;
  const usedCategories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <p className="text-2xl font-bold text-white">{products.length}</p>
          <p className="text-xs text-gray-400">Total items</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <p className="text-2xl font-bold text-emerald-400">{availableCount}</p>
          <p className="text-xs text-gray-400">Available</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <p className="text-2xl font-bold text-amber-400">{products.length - availableCount}</p>
          <p className="text-xs text-gray-400">Unavailable</p>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-600/20 bg-gray-900 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            {editItem ? `Edit ${cfg.itemLabel}` : `Add ${cfg.itemLabel}`}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={`${cfg.itemLabel} name`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {cfg.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {"Price" + (CURRENCY ? " (" + CURRENCY + ")" : "")}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={
                  shopCategory === 'clinic' ? 'Specialist in..., MBBS from..., etc.' :
                  shopCategory === 'restaurant' ? 'Ingredients, serving size, etc.' :
                  'Optional description'
                }
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>

            {/* SKU */}
            {cfg.extraFields.includes('sku') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">SKU / Item Code</label>
                <input
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. SKU-001"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Stock */}
            {cfg.extraFields.includes('stock') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_qty}
                  onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))}
                  placeholder="Leave blank = unlimited"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Unit */}
            {cfg.extraFields.includes('unit') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Unit</label>
                <select
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {['piece', 'kg', 'gram', 'liter', 'ml', 'dozen', 'pack', 'bag', 'bundle'].map(u =>
                    <option key={u} value={u}>{u}</option>
                  )}
                </select>
              </div>
            )}

            {/* Duration (salon/services/clinic) */}
            {cfg.extraFields.includes('duration') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Duration (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  placeholder="e.g. 30"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Schedule (clinic) */}
            {cfg.extraFields.includes('schedule') && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Schedule / Availability</label>
                <input
                  value={form.schedule}
                  onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                  placeholder="e.g. Sat-Thu 9am-5pm, Fri off"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Restaurant flags */}
            {cfg.extraFields.includes('spicy') && (
              <div className="sm:col-span-2 flex items-center gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.spicy} onChange={e => setForm(f => ({ ...f, spicy: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500" />
                  <span className="text-sm text-gray-300">🌶️ Spicy</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.veg} onChange={e => setForm(f => ({ ...f, veg: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500" />
                  <span className="text-sm text-gray-300">🥬 Vegetarian</span>
                </label>
              </div>
            )}

            {/* Location (real estate) */}
            {cfg.extraFields.includes('location') && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Location / Address</label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Gulshan 2, Dhaka"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Bedrooms / Bathrooms (real estate) */}
            {cfg.extraFields.includes('bedrooms') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Bedrooms</label>
                <input
                  type="number" min="0"
                  value={form.bedrooms}
                  onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))}
                  placeholder="e.g. 3"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
            {cfg.extraFields.includes('bathrooms') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Bathrooms</label>
                <input
                  type="number" min="0"
                  value={form.bathrooms}
                  onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))}
                  placeholder="e.g. 2"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Area size (real estate) */}
            {cfg.extraFields.includes('area_size') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Area Size (sqft)</label>
                <input
                  value={form.area_size}
                  onChange={e => setForm(f => ({ ...f, area_size: e.target.value }))}
                  placeholder="e.g. 1200 sqft"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Instructor (education) */}
            {cfg.extraFields.includes('instructor') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Instructor / Teacher</label>
                <input
                  value={form.instructor}
                  onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))}
                  placeholder="e.g. Prof. Rahman"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Delivery time (creative agency) */}
            {cfg.extraFields.includes('delivery_time') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Delivery Time</label>
                <input
                  value={form.delivery_time}
                  onChange={e => setForm(f => ({ ...f, delivery_time: e.target.value }))}
                  placeholder="e.g. 7-10 business days"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Clinic / Diagnostic test fields */}
            {cfg.extraFields.includes('sample_type') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Sample Type</label>
                <input
                  value={form.sample_type}
                  onChange={e => setForm(f => ({ ...f, sample_type: e.target.value }))}
                  placeholder="e.g. Blood, Urine, Stool, Swab"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
            {cfg.extraFields.includes('turnaround_time') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Turnaround Time</label>
                <input
                  value={form.turnaround_time}
                  onChange={e => setForm(f => ({ ...f, turnaround_time: e.target.value }))}
                  placeholder="e.g. Same day, 24 hours, 3-5 days"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
            {cfg.extraFields.includes('preparation') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Preparation Required</label>
                <input
                  value={form.preparation}
                  onChange={e => setForm(f => ({ ...f, preparation: e.target.value }))}
                  placeholder="e.g. Fasting 8 hours, No preparation needed"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
            {cfg.extraFields.includes('report_format') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Report Format</label>
                <input
                  value={form.report_format}
                  onChange={e => setForm(f => ({ ...f, report_format: e.target.value }))}
                  placeholder="e.g. Printed + PDF, Online portal, WhatsApp"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            {/* Pharmacy flags */}
            {cfg.extraFields.includes('generic') && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Generic Name</label>
                  <input
                    value={form.generic}
                    onChange={e => setForm(f => ({ ...f, generic: e.target.value }))}
                    placeholder="Generic/chemical name"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-5">
                    <input type="checkbox" checked={form.prescription}
                      onChange={e => setForm(f => ({ ...f, prescription: e.target.checked }))}
                      className="w-4 h-4 rounded accent-emerald-500" />
                    <span className="text-sm text-gray-300">Requires prescription</span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={pending || !form.name.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> :
               editItem ? 'Update' : `Add ${cfg.itemLabel}`}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${cfg.title.toLowerCase()}…`}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterCat('all')}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterCat === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >All</button>
          {usedCategories.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterCat === c ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >{c}</button>
          ))}
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditItem(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shrink-0"
          >
            <Plus size={15} /> Add {cfg.itemLabel}
          </button>
        )}
      </div>

      {/* Product list */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <Package size={28} className="text-gray-700" />
            <div>
              <p className="text-sm font-medium text-white">
                {products.length === 0 ? `No ${cfg.title.toLowerCase()} yet` : 'No results'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {products.length === 0
                  ? `Add your first ${cfg.itemLabel.toLowerCase()} — the AI will use it to answer customer questions.`
                  : 'Try a different search or category filter.'}
              </p>
            </div>
            {products.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                <Plus size={14} /> Add first item
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filtered.map(product => (
              <div
                key={product.id}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-700/30 transition-colors ${!product.is_available ? 'opacity-50' : ''}`}
              >
                {/* Availability toggle */}
                <button
                  onClick={() => handleToggle(product.id, product.is_available)}
                  disabled={pending}
                  className="shrink-0 text-gray-500 hover:text-emerald-400 transition-colors"
                  title={product.is_available ? 'Mark unavailable' : 'Mark available'}
                >
                  {product.is_available
                    ? <ToggleRight size={22} className="text-emerald-400" />
                    : <ToggleLeft size={22} />}
                </button>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(product)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                    {product.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">{product.category}</span>
                    )}
                    {product.metadata?.spicy && <span className="text-[11px]">🌶️</span>}
                    {product.metadata?.veg && <span className="text-[11px]">🥬</span>}
                    {product.metadata?.requires_prescription && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Rx</span>}
                  </div>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{product.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {product.metadata?.schedule && (
                      <span className="text-[11px] text-cyan-400">📅 {product.metadata.schedule}</span>
                    )}
                    {product.metadata?.duration_min && (
                      <span className="text-[11px] text-gray-500">⏱ {product.metadata.duration_min}min</span>
                    )}
                    {product.metadata?.location && (
                      <span className="text-[11px] text-cyan-400">📍 {product.metadata.location}</span>
                    )}
                    {product.metadata?.bedrooms && (
                      <span className="text-[11px] text-gray-500">🛏 {product.metadata.bedrooms} bed</span>
                    )}
                    {product.metadata?.area_size && (
                      <span className="text-[11px] text-gray-500">📐 {product.metadata.area_size}</span>
                    )}
                    {product.metadata?.instructor && (
                      <span className="text-[11px] text-cyan-400">👤 {product.metadata.instructor}</span>
                    )}
                    {product.metadata?.delivery_time && (
                      <span className="text-[11px] text-gray-500">🚀 {product.metadata.delivery_time}</span>
                    )}
                    {product.stock_qty !== null && product.stock_qty !== undefined && (
                      <span className={`text-[11px] ${product.stock_qty > 0 ? 'text-gray-500' : 'text-red-400'}`}>
                        Stock: {product.stock_qty} {product.unit ?? ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {product.price !== null && product.price !== undefined && (
                    <span className="text-sm font-semibold text-emerald-400">
                      {CURRENCY}{product.price.toLocaleString()}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    {deletingId === product.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI note */}
      {products.length > 0 && (
        <p className="text-xs text-gray-500 text-center">
          💡 Your AI assistant automatically uses this {cfg.title.toLowerCase()} to answer customer questions during voice calls.
        </p>
      )}
    </div>
  );
}
