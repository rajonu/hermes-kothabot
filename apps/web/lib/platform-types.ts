// Pure types + helpers safe for client components.
// `platform-settings.ts` re-exports these alongside its server-only loaders.

export interface PaymentMethod {
  number: string;
  qr_url: string | null;
  enabled: boolean;
  /**
   * Regions where this method is shown to clients.
   * Defaults applied if missing: manual methods → ['BD'], Paddle → ['BD','INTL'].
   */
  regions?: ('BD' | 'INTL')[];
  /** Paddle hosted checkout URL (used only by the `paddle` method). */
  checkout_url?: string | null;
}

export type PaymentMethodId = 'bkash' | 'nagad' | 'rocket' | 'paddle';

export interface PlatformPlan {
  name: string;
  // BDT pricing (Bangladesh)
  price: number;
  currency: string;
  // USD pricing (Global) — stored in cents (e.g. 999 = $9.99)
  price_usd: number;
  currency_usd: string;
  // Legacy Lemon Squeezy checkout URL (Paddle has replaced this; field kept
  // for backwards compat with existing rows in platform_settings).
  ls_checkout_url?: string | null;
  period_days: number;
  call_limit: number;
  /** Talk-time cap in minutes per period. -1 = unlimited. Whichever of
   *  call_limit OR minute_limit is reached first blocks new calls. */
  minute_limit?: number;
  features: string[];
}

/**
 * Returns payment methods that are enabled AND available to the given region.
 * Falls back to legacy defaults if `regions` is unset on a method:
 *   - paddle → ['BD','INTL']
 *   - all other methods → ['BD'] (manual mobile-money methods are BD-only)
 */
export function methodsForRegion(
  methods: Record<PaymentMethodId, PaymentMethod>,
  region: 'BD' | 'INTL'
): Array<{ id: PaymentMethodId; method: PaymentMethod }> {
  const order: PaymentMethodId[] = ['bkash', 'nagad', 'rocket', 'paddle'];
  const out: Array<{ id: PaymentMethodId; method: PaymentMethod }> = [];
  for (const id of order) {
    const m = methods[id];
    if (!m || !m.enabled) continue;
    const regions = m.regions ?? (id === 'paddle' ? ['BD', 'INTL'] : ['BD']);
    if (regions.includes(region)) out.push({ id, method: m });
  }
  return out;
}

export function formatPrice(plan: PlatformPlan) {
  if (plan.price === 0) return 'Free';
  const sym = plan.currency === 'BDT' ? '৳' : '$';
  return `${sym}${plan.price.toLocaleString()}`;
}
