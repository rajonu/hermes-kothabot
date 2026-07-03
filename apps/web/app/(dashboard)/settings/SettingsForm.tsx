"use client";

import { useState } from "react";
import { Loader2, Check, Lock } from "lucide-react";
import { updateShopSettings } from "@/modules/settings/actions";
import { toast } from "sonner";
import type { Shop } from "@/lib/supabase/types";
import { getCategoryNav } from "@/lib/category-nav";

const CATEGORIES = [
  "restaurant", "retail", "salon", "clinic", "pharmacy", "grocery", "services", "other"
];
const LANGUAGES = [
  { value: "auto", label: "Auto-detect (Bangla + English)" },
  { value: "bn", label: "Bangla only" },
  { value: "en", label: "English only" },
];
const PERSONALITIES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly & Casual" },
  { value: "formal", label: "Formal" },
];

interface Props {
  shop: Shop | null;
  userEmail?: string;
}

const CLINIC_CATEGORIES = new Set(['clinic', 'pharmacy', 'hospital', 'healthcare']);
type ToggleProps = { enabled: boolean; onChange: (v: boolean) => void; label: string; description: string };
function Toggle({ enabled, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#e8f5e9]">{label}</p>
        <p className="text-xs text-[#7a9e88]">{description}</p>
      </div>
      <button type="button" onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-[#00e676]' : 'bg-[#1e3d2c]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
function getNameLabel(category?: string | null) {
  return CLINIC_CATEGORIES.has(category ?? '') ? 'Company Name' : 'Shop Name';
}
function getSectionLabel(category?: string | null) {
  return CLINIC_CATEGORIES.has(category ?? '') ? 'Company Information' : 'Shop Information';
}

export function SettingsForm({ shop, userEmail }: Props) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const aiConfig     = (shop?.ai_config as any) ?? {};
  const widgetConfig = (shop?.widget_config as any) ?? {};
  const billingRegion = aiConfig.billing_region ?? 'BD';
  const isIntl = billingRegion === 'INTL';
  // For INTL shops, "auto" (Bangla+English) makes no sense — treat as "en"
  const effectiveLanguage = (aiConfig.language === 'auto' && isIntl) ? 'en' : (aiConfig.language ?? (isIntl ? 'en' : 'auto'));
  const defaultGreeting = isIntl
    ? `Hello! I am an intelligent assistant of ${shop?.name ?? 'ours'}. How may I help you today?`
    : "হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?";
  const collectFields = aiConfig.collect_fields ?? { name: true, phone: true, address: true };
  const [collectName,    setCollectName]    = useState<boolean>(collectFields.name    !== false);
  const [collectPhone,   setCollectPhone]   = useState<boolean>(collectFields.phone   !== false);
  const [collectAddress, setCollectAddress] = useState<boolean>(collectFields.address !== false);
  const [enableVoice, setEnableVoice] = useState<boolean>(widgetConfig.enableVoice !== false);
  const [enableChat,  setEnableChat]  = useState<boolean>(widgetConfig.enableChat  !== false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const result = await updateShopSettings(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setSaved(true);
      toast.success("Settings saved!");
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {/* Shop info */}
      <section className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-4">{getSectionLabel(shop?.category)}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">{getNameLabel(shop?.category)}</label>
            <input name="name" defaultValue={shop?.name ?? ""} required
              className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Business Category</label>
            <div className="relative">
              <input
                value={(shop?.category ?? 'other').charAt(0).toUpperCase() + (shop?.category ?? 'other').slice(1)}
                disabled
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#0f1f18] border border-[#1e3d2c] text-sm text-[#7a9e88] cursor-not-allowed"
              />
              <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a5e48]" />
            </div>
            <p className="text-[11px] text-[#3a5e48] mt-1.5">
              🔒 Category is set at registration. Contact support to change it.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Account Email</label>
            <input value={userEmail ?? ""} disabled
              className="w-full px-3 py-2.5 rounded-lg bg-[#0f1f18] border border-[#1e3d2c] text-sm text-[#7a9e88] cursor-not-allowed" />
          </div>
        </div>
      </section>

      {/* AI config */}
      <section className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">AI Configuration</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Control how your AI assistant behaves on calls.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">System Prompt</label>
            <textarea name="systemPrompt" rows={4}
              defaultValue={aiConfig.systemPrompt ?? ""}
              placeholder="Describe your business and how the AI should respond. E.g: You are an assistant for Raj's Kitchen, a restaurant in Dhaka. Help customers place orders, answer menu questions, and take reservations."
              className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] placeholder-[#3a5e48] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Language</label>
              <select name="language" defaultValue={effectiveLanguage}
                className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] focus:outline-none focus:border-[#00e676]/50 transition-colors">
                {LANGUAGES.map(l => <option key={l.value} value={l.value} className="bg-[#162b20]">{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Personality</label>
              <select name="personality" defaultValue={aiConfig.personality ?? "professional"}
                className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] focus:outline-none focus:border-[#00e676]/50 transition-colors">
                {PERSONALITIES.map(p => <option key={p.value} value={p.value} className="bg-[#162b20]">{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Order collection fields */}
      <section className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Order Collection</h2>
        <p className="text-xs text-[#7a9e88] mb-4">
          Choose what information your AI assistant collects from customers before confirming an order or appointment.
        </p>
        <div className="space-y-3">
          {[
            { key: 'name',    label: 'Customer Name',     desc: 'Ask for the customer\'s full name',      state: collectName,    set: setCollectName,    required: true },
            { key: 'phone',   label: 'Phone Number',      desc: 'Ask for a contact phone number',         state: collectPhone,   set: setCollectPhone,   required: false },
            { key: 'address', label: 'Delivery Address',  desc: 'Ask for a delivery or pickup address',   state: collectAddress, set: setCollectAddress, required: false },
          ].map(({ key, label, desc, state, set, required }) => (
            <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              state ? 'border-[#1e3d2c] bg-[#162b20]' : 'border-[#1e3d2c] bg-[#0f1f18] opacity-60'
            } ${required ? 'cursor-default' : ''}`}>
              <input
                type="checkbox"
                checked={state}
                disabled={required}
                onChange={e => !required && set(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#00e676]"
              />
              <div>
                <p className="text-sm font-medium text-[#e8f5e9]">
                  {label}
                  {required && <span className="ml-2 text-[10px] text-[#3a5e48] font-normal">(always required)</span>}
                </p>
                <p className="text-xs text-[#7a9e88] mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        {/* Hidden inputs to submit collect_fields as JSON */}
        <input type="hidden" name="collect_name"    value={collectName    ? '1' : '0'} />
        <input type="hidden" name="collect_phone"   value={collectPhone   ? '1' : '0'} />
        <input type="hidden" name="collect_address" value={collectAddress ? '1' : '0'} />
        <input type="hidden" name="enable_voice"    value={enableVoice ? '1' : '0'} />
        <input type="hidden" name="enable_chat"     value={enableChat  ? '1' : '0'} />
        {!collectPhone && !collectAddress && (
          <p className="text-xs text-amber-400 mt-3 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
            ⚠ With no phone or address, orders will only include the customer's name.
          </p>
        )}
      </section>

      {/* Widget config */}
      <section className="rounded-xl border border-[#1e3d2c] bg-[#0f1f18] p-6">
        <h2 className="text-sm font-semibold text-[#e8f5e9] mb-1">Widget</h2>
        <p className="text-xs text-[#7a9e88] mb-4">Customize the chat widget that appears on your website.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Greeting Message</label>
            <input name="greeting"
              defaultValue={widgetConfig.greeting ?? defaultGreeting}
              className="w-full px-3 py-2.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-sm text-[#e8f5e9] focus:outline-none focus:border-[#00e676]/50 focus:ring-1 focus:ring-[#00e676]/20 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#7a9e88] mb-1.5">Brand Color</label>
            <div className="flex items-center gap-3">
              <input type="color" name="primaryColor"
                defaultValue={widgetConfig.primaryColor ?? "#00e676"}
                className="h-9 w-14 rounded-lg bg-[#162b20] border border-[#1e3d2c] cursor-pointer p-1" />
              <span className="text-xs text-[#7a9e88]">Used for buttons and accents in your widget</span>
            </div>
          </div>

          <div className="border-t border-[#1e3d2c] pt-4 space-y-3">
            <p className="text-xs font-medium text-[#7a9e88] mb-1">Widget Modes</p>
            <Toggle
              enabled={enableVoice}
              onChange={v => { if (!v && !enableChat) return; setEnableVoice(v); }}
              label="Voice Mode"
              description={`${getCategoryNav(shop?.category).customersLabel} can call and talk to your AI assistant`}
            />
            <Toggle
              enabled={enableChat}
              onChange={v => { if (!v && !enableVoice) return; setEnableChat(v); }}
              label="Chat Mode"
              description={`${getCategoryNav(shop?.category).customersLabel} can type messages to your AI assistant`}
            />
            {!enableVoice && !enableChat && (
              <p className="text-xs text-amber-400">Enable at least one mode.</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={pending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00e676] text-[#09110e] font-semibold text-sm hover:bg-[#00e676]/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
          {pending && <Loader2 size={14} className="animate-spin" />}
          {saved && <Check size={14} />}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
