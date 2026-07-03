import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/PageHeader";
import { CheckCircle, Clock, Zap } from "lucide-react";
import { getPlatformSettings, formatPrice } from "@/lib/platform-settings";
// Note: region is detected ONCE at signup and stored in ai_config.billing_region
// No geo calls on billing page — always reads the stored value
import { PaymentModal } from "./PaymentModal";
import { SubmittedRequests } from "./SubmittedRequests";

const PLAN_COLORS: Record<string, string> = {
  trial:    '#9ca3af',
  starter:  '#10b981',
  pro:      '#06b6d4',
  business: '#f59e0b',
};
const PLAN_ORDER = ['trial', 'starter', 'pro', 'business'];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ pay?: string }> }) {
  const { pay } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await (supabase as any)
    .from('shops').select('id, name, ai_config').eq('owner_id', user.id).single();
  if (!shopRaw) return null;

  const db = createAdminClient();
  const [subData, settings, requestsData] = await Promise.all([
    (db as any).from('subscriptions').select('plan_id,plan,status,current_period_end,calls_used,minutes_used,extra_calls,extra_minutes').eq('shop_id', shopRaw.id).maybeSingle(),
    getPlatformSettings(),
    (db as any).from('payment_requests').select('id,plan_id,amount,method,status,admin_note,created_at')
      .eq('shop_id', shopRaw.id).order('created_at', { ascending: false }).limit(10),
  ]);

  // plan_id = new flexible text field (starter/pro/business/trial)
  // fall back to 'trial' if no subscription or plan_id not set
  const currentPlan    = subData.data?.plan_id || 'trial';
  const subStatus      = subData.data?.status || 'trial';
  const expiresAt      = subData.data?.current_period_end ? new Date(subData.data.current_period_end) : null;

  // Usage data
  const callsUsed     = subData.data?.calls_used    ?? 0;
  const minutesUsed   = subData.data?.minutes_used  ?? 0;
  const extraCalls    = subData.data?.extra_calls   ?? 0;
  const extraMinutes  = subData.data?.extra_minutes ?? 0;
  const planRow       = settings.plans[currentPlan as keyof typeof settings.plans];
  const planCallLimit   = planRow?.call_limit   ?? 30;
  const planMinuteLimit = (planRow as any)?.minute_limit ?? planCallLimit;
  const totalCallsAllowed   = planCallLimit   === -1 ? -1 : Math.max(0, planCallLimit   + extraCalls);
  const totalMinutesAllowed = planMinuteLimit === -1 ? -1 : Math.max(0, planMinuteLimit + extraMinutes);
  const callPercent   = totalCallsAllowed   === -1 || totalCallsAllowed   === 0 ? 0 : Math.min(100, Math.round((callsUsed   / totalCallsAllowed)   * 100));
  const minutePercent = totalMinutesAllowed === -1 || totalMinutesAllowed === 0 ? 0 : Math.min(100, Math.round((minutesUsed / totalMinutesAllowed) * 100));
  const daysLeft       = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;
  const paymentHistory = requestsData.data ?? [];

  // Region: stored at signup in ai_config.billing_region — never auto-detected again
  // Admin can override anytime from /admin/shops/[id]
  const storedRegion = (shopRaw as any).ai_config?.billing_region as 'BD' | 'INTL' | undefined;
  const effectiveRegion = storedRegion ?? 'BD'; // default BD if somehow missing
  const isBD            = effectiveRegion === 'BD';
  const currency        = isBD ? 'BDT' : 'USD';
  const regionSource    = storedRegion ? 'stored' : 'default';

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription plan." docsUrl="https://kothabot.ai.bd/docs/subscription-plans" />

      {/* Usage summary card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">This Month's Usage</h2>
          <span className="text-xs text-gray-500 capitalize">{currentPlan} plan</span>
        </div>

        {/* Calls */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">Calls</span>
            <span className="text-xs text-white font-semibold">
              {callsUsed.toLocaleString()}
              {' / '}
              {totalCallsAllowed === -1 ? 'Unlimited' : totalCallsAllowed.toLocaleString()}
            </span>
          </div>
          {totalCallsAllowed !== -1 && (
            <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  callPercent >= 90 ? 'bg-red-500' : callPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${callPercent}%` }}
              />
            </div>
          )}
          {totalCallsAllowed === -1 && (
            <div className="text-[11px] text-cyan-400 font-semibold">Unlimited calls included</div>
          )}
        </div>

        {/* Minutes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">Talk time</span>
            <span className="text-xs text-white font-semibold">
              {minutesUsed.toLocaleString()} min
              {' / '}
              {totalMinutesAllowed === -1 ? 'Unlimited' : `${totalMinutesAllowed.toLocaleString()} min`}
            </span>
          </div>
          {totalMinutesAllowed !== -1 && (
            <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  minutePercent >= 90 ? 'bg-red-500' : minutePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${minutePercent}%` }}
              />
            </div>
          )}
          {totalMinutesAllowed === -1 && (
            <div className="text-[11px] text-cyan-400 font-semibold">Unlimited minutes included</div>
          )}
        </div>

        {currentPlan === 'trial' && totalCallsAllowed !== -1 && totalMinutesAllowed !== -1 && (
          <p className="text-[11px] text-gray-500 -mt-1">
            Trial ends when either limit is reached — whichever comes first.
          </p>
        )}
      </div>

      {/* Current plan banner */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
            <Zap size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Current plan: <span className="capitalize text-emerald-400">{currentPlan}</span>
            </p>
            {daysLeft !== null && (
              <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${daysLeft < 5 ? 'text-red-400' : 'text-gray-400'}`}>
                <Clock size={11} />
                {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'}
                {expiresAt && ` · Renews ${expiresAt.toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' })}`}
              </p>
            )}
          </div>
        </div>
          {/* Geo indicator */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
            isBD
              ? 'text-green-400 bg-green-400/10 border-green-400/20'
              : 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
          }`}>
            {isBD ? '🇧🇩 BDT Pricing' : '🌍 USD Pricing'}
          </span>
        </div>
        {(currentPlan === 'trial' || subStatus === 'trial') && (
          <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg font-medium">
            ⚠ Upgrade before trial ends to keep your AI assistant active
          </span>
        )}
      </div>

      {/* Plan cards — built from DB settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {PLAN_ORDER.map(planId => {
          const plan     = settings.plans[planId as keyof typeof settings.plans];
          const isCurrent = currentPlan === planId;
          const color     = PLAN_COLORS[planId] ?? '#9ca3af';
          const isPopular = planId === 'pro';
          const hasPending = paymentHistory.some((r: any) => r.plan_id === planId && r.status === 'pending');

          return (
            <div key={planId} className={`relative rounded-xl border-2 bg-gray-800 p-5 flex flex-col ${
              isCurrent ? 'border-emerald-500' : isPopular ? 'border-cyan-500/50' : 'border-gray-700'
            }`}>
              {isCurrent && (
                <span className="absolute -top-3 left-4 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500 text-white">CURRENT</span>
              )}
              {!isCurrent && isPopular && (
                <span className="absolute -top-3 left-4 text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-500 text-white">POPULAR</span>
              )}
              {hasPending && (
                <span className="absolute -top-3 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">PENDING</span>
              )}

              <div className="mb-4">
                <h3 className="text-sm font-bold mb-1" style={{ color }}>{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-bold text-white">Free</span>
                  ) : isBD ? (
                    <>
                      <span className="text-xs text-gray-400">৳</span>
                      <span className="text-2xl font-bold text-white">{plan.price.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-gray-400">$</span>
                      <span className="text-2xl font-bold text-white">{(plan.price_usd / 100).toFixed(2)}</span>
                      <span className="text-xs text-gray-400">/month</span>
                    </>
                  )}
                </div>
                {plan.price === 0 && <p className="text-xs text-gray-500 mt-0.5">{plan.period_days} days free</p>}
              </div>

              <div className="flex-1 mb-5 pt-2">
                <a
                  href="https://kothabot.ai.bd#pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-white underline transition-colors"
                >
                  View plan features & details →
                </a>
              </div>

              {isCurrent && subStatus === 'active' ? (
                <div className="text-center py-2 text-xs text-emerald-400 font-semibold">✓ Active</div>
              ) : plan.price > 0 ? (
                <PaymentModal
                  planId={planId}
                  planName={plan.name}
                  amount={isBD ? plan.price : plan.price_usd}
                  currency={isBD ? 'BDT' : 'USD'}
                  shopId={shopRaw.id}
                  shopName={shopRaw.name}
                  paymentMethods={settings.payment_methods}
                  lsCheckoutUrl={plan.ls_checkout_url ?? null}
                  color={color}
                  disabled={hasPending}
                  isBD={isBD}
                  autoOpen={pay === 'true' && isCurrent && !hasPending}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Payment request history */}
      <SubmittedRequests requests={paymentHistory} />

    </div>
  );
}
