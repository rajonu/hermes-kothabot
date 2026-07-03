import { getPlatformSettings, getGlobalAIRules, getInAppBrowserProtection, getCategoryPrompts, getSipProviderIps } from '@/lib/platform-settings';
import { DEFAULT_CATEGORY_PROMPTS, ALL_CATEGORIES } from '@/lib/prompt-layers';
import { PaymentSettingsForm } from './PaymentSettingsForm';
import { PlanSettingsForm } from './PlanSettingsForm';
import { CategoryToggleForm } from './CategoryToggleForm';
import { GlobalAIRulesForm } from './GlobalAIRulesForm';
import { SipSettingsForm } from './SipSettingsForm';
import { createAdminClient } from '@/lib/supabase/server';

export default async function AdminSettingsPage() {
  const [settings, globalAIRules, inappBrowserProtection, storedCategoryPrompts, sipProviderIps, shopsData, voiceLinksData] = await Promise.all([
    getPlatformSettings(),
    getGlobalAIRules(),
    getInAppBrowserProtection(),
    getCategoryPrompts(),
    getSipProviderIps(),
    (async () => {
      const db = createAdminClient();
      return (db as any).from('shops')
        .select('id, name, subscriptions(plan_id, status, current_period_end)')
        .order('created_at', { ascending: false });
    })(),
    (async () => {
      const db = createAdminClient();
      // Fetch shops with voice link info + visit counts in last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [shopsRes, visitsRes] = await Promise.all([
        (db as any).from('shops')
          .select('id, name, public_slug, public_access_enabled')
          .order('created_at', { ascending: false }),
        (db as any).from('public_link_visits')
          .select('shop_id, event_type')
          .gte('created_at', since),
      ]);
      return { shops: shopsRes.data ?? [], visits: visitsRes.data ?? [] };
    })(),
  ]);

  const shops = shopsData.data ?? [];

  // Merge DB-stored prompts over defaults so admin always sees a value
  const initialCategoryPrompts: Record<string, string> = {};
  for (const cat of ALL_CATEGORIES) {
    initialCategoryPrompts[cat] = storedCategoryPrompts[cat] ?? DEFAULT_CATEGORY_PROMPTS[cat] ?? '';
  }
  const voiceLinkShops = voiceLinksData.shops as Array<{
    id: string;
    name: string;
    public_slug: string | null;
    public_access_enabled: boolean;
  }>;
  const allVisits = voiceLinksData.visits as Array<{ shop_id: string; event_type: string }>;

  return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">
        <div className="mb-2">
          <h1 className="text-sm font-bold text-white">Platform Settings</h1>
          <p className="text-xs text-gray-500">Payment numbers, QR codes, plan pricing</p>
        </div>

        {/* Payment Methods */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Payment Methods</h2>
            <p className="text-xs text-gray-400 mt-0.5">Phone numbers and QR codes shown to customers. Changes take effect immediately.</p>
          </div>
          <div className="p-5">
            <PaymentSettingsForm initialSettings={settings.payment_methods} />
          </div>
        </div>

        {/* Global SIP Settings */}
        <div className="rounded-xl border border-indigo-800/40 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/15 flex items-center justify-center text-base">📞</div>
            <div>
              <h2 className="text-sm font-semibold text-white">Master Admin SIP Providers</h2>
              <p className="text-xs text-gray-400 mt-0.5">Whitelist IP addresses for your SIP Providers (e.g. Brilliant, AmberIT). The VPS will automatically accept calls from these IPs.</p>
            </div>
          </div>
          <div className="p-5">
            <SipSettingsForm initialIps={sipProviderIps} />
          </div>
        </div>

        {/* Category Toggles */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Signup Categories</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toggle which business categories appear on the signup form. Disabled categories are hidden from new registrations.</p>
          </div>
          <div className="p-5">
            <CategoryToggleForm enabledCategories={settings.enabled_categories} />
          </div>
        </div>

        {/* Plan Pricing */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Subscription Plans</h2>
            <p className="text-xs text-gray-400 mt-0.5">Edit plan names, prices, features and call limits.</p>
          </div>
          <div className="p-5">
            <PlanSettingsForm initialPlans={settings.plans} />
          </div>
        </div>

        {/* Voice Settings */}
        <div className="rounded-xl border border-blue-800/40 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/15 flex items-center justify-center text-base">🛡️</div>
            <div>
              <h2 className="text-sm font-semibold text-white">Voice Settings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Configuration for voice widget behavior across all public voice links.</p>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-2">
              <p className="text-sm font-medium text-white mb-0.5">Enable In-App Browser Protection</p>
            </div>
            <VoiceProtectionForm initialEnabled={inappBrowserProtection} />
          </div>
        </div>

        {/* Category Prompts */}
        <div className="rounded-xl border border-violet-800/40 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center text-base">📂</div>
            <div>
              <h2 className="text-sm font-semibold text-white">Category Prompts — Layer 3</h2>
              <p className="text-xs text-gray-400 mt-0.5">Booking &amp; order collection rules per business category. Only the matching category is loaded per session.</p>
            </div>
          </div>
          <div className="p-5">
            <CategoryPromptsForm initialPrompts={initialCategoryPrompts} />
          </div>
        </div>

        {/* Global AI Rules */}
        <div className="rounded-xl border border-emerald-800/40 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/15 flex items-center justify-center text-base">🤖</div>
            <div>
              <h2 className="text-sm font-semibold text-white">Global AI Rules</h2>
              <p className="text-xs text-gray-400 mt-0.5">System instructions injected into ALL voice calls and chat sessions across every shop.</p>
            </div>
          </div>
          <div className="p-5">
            <GlobalAIRulesForm initialRules={globalAIRules} />
          </div>
        </div>

        {/* Public Voice Links */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Public Voice Links</h2>
            <p className="text-xs text-gray-400 mt-0.5">All shops with public voice links configured (last 30 days stats).</p>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Shop</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Slug</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">Visits</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400">Voice Starts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {voiceLinkShops.filter((s) => s.public_slug).map((s) => {
                  const shopVisits = allVisits.filter((v) => v.shop_id === s.id);
                  const visitCount = shopVisits.filter((v) => v.event_type === 'visit').length;
                  const voiceCount = shopVisits.filter((v) => v.event_type === 'voice_start').length;
                  return (
                    <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                      <td className="px-5 py-3 font-mono text-emerald-400 text-xs">
                        {s.public_slug}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.public_access_enabled
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                            : 'bg-gray-700 text-gray-400 border border-gray-600'
                        }`}>
                          {s.public_access_enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center text-gray-300">{visitCount}</td>
                      <td className="px-5 py-3 text-center text-emerald-400 font-medium">{voiceCount}</td>
                    </tr>
                  );
                })}
                {voiceLinkShops.filter((s) => s.public_slug).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-gray-500 text-sm">
                      No shops have configured voice links yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trial Extension */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Extend / Override Subscriptions</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manually extend trials or change any shop's plan end date.</p>
          </div>
          <div className="p-5">
            <TrialExtensionList shops={shops} />
          </div>
        </div>

      </div>
  );
}

function TrialExtensionList({ shops }: { shops: any[] }) {
  // This is a server component wrapper — the actual interactive form is client
  return <TrialExtensionForm shops={shops} />;
}

// Inline client component for trial extension
import { TrialExtensionForm } from './TrialExtensionForm';
import { VoiceProtectionForm } from './VoiceProtectionForm';
import { CategoryPromptsForm } from './CategoryPromptsForm';
