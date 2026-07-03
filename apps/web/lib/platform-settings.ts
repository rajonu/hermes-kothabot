import { createAdminClient } from './supabase/server';
import { DEFAULT_GLOBAL_AI_RULES } from './ai-rules-default';
export { DEFAULT_GLOBAL_AI_RULES } from './ai-rules-default';

// Re-export pure types + helpers so existing imports from
// '@/lib/platform-settings' keep working without changes.
export type { PaymentMethod, PaymentMethodId, PlatformPlan } from './platform-types';
export { methodsForRegion, formatPrice } from './platform-types';

import type { PaymentMethod, PaymentMethodId, PlatformPlan } from './platform-types';

export interface PlatformSettings {
  payment_methods: Record<PaymentMethodId, PaymentMethod>;
  plans: Record<'trial' | 'starter' | 'pro' | 'business', PlatformPlan>;
  notifications: { email: string; payment_notify: boolean };
  enabled_categories: string[];
}

const DEFAULTS: PlatformSettings = {
  payment_methods: {
    bkash:  { number: '01XXXXXXXXX', qr_url: null, enabled: true,  regions: ['BD'] },
    nagad:  { number: '01XXXXXXXXX', qr_url: null, enabled: false, regions: ['BD'] },
    rocket: { number: '01XXXXXXXXX', qr_url: null, enabled: false, regions: ['BD'] },
    paddle: { number: '',            qr_url: null, enabled: true,  regions: ['BD', 'INTL'], checkout_url: null },
  },
  plans: {
    trial:    { name: 'Trial',    price: 0,    currency: 'BDT', price_usd: 0,    currency_usd: 'USD', ls_checkout_url: null, period_days: 14, call_limit: 30,   minute_limit: 30,   features: ['30 calls or 30 minutes (whichever first)','1 widget','All AI models','Email support'] },
    starter:  { name: 'Starter',  price: 999,  currency: 'BDT', price_usd: 999,  currency_usd: 'USD', ls_checkout_url: null, period_days: 30, call_limit: 500,  minute_limit: 500,  features: ['500 calls/month','1 widget','All AI models','Priority support','Analytics'] },
    pro:      { name: 'Pro',      price: 2499, currency: 'BDT', price_usd: 2499, currency_usd: 'USD', ls_checkout_url: null, period_days: 30, call_limit: 2000, minute_limit: 2000, features: ['2,000 calls/month','3 widgets','Custom voice','Dedicated support','Analytics','API access'] },
    business: { name: 'Business', price: 5999, currency: 'BDT', price_usd: 5999, currency_usd: 'USD', ls_checkout_url: null, period_days: 30, call_limit: -1,   minute_limit: -1,   features: ['Unlimited calls','Unlimited widgets','White label','SLA guarantee','All Pro features','Custom integrations'] },
  },
  notifications: { email: 'pay@kothabot.ai', payment_notify: true },
  enabled_categories: ['clinic', 'salon', 'services', 'restaurant', 'retail', 'pharmacy', 'real_estate', 'education', 'creative_agency', 'grocery', 'other'],
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const db = createAdminClient();
    const { data } = await (db as any)
      .from('platform_settings')
      .select('key, value');

    if (!data || data.length === 0) return DEFAULTS;

    const map: Record<string, any> = {};
    data.forEach((row: any) => { map[row.key] = row.value; });

    return {
      payment_methods:    map.payment_methods    ?? DEFAULTS.payment_methods,
      plans:              map.plans              ?? DEFAULTS.plans,
      notifications:      map.notifications      ?? DEFAULTS.notifications,
      enabled_categories: map.enabled_categories ?? DEFAULTS.enabled_categories,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function getGlobalAIRules(): Promise<string> {
  try {
    const db = createAdminClient();
    const { data } = await (db as any)
      .from('platform_settings')
      .select('value')
      .eq('key', 'global_ai_rules')
      .maybeSingle();
    return data?.value ?? DEFAULT_GLOBAL_AI_RULES;
  } catch {
    return DEFAULT_GLOBAL_AI_RULES;
  }
}

export async function getCategoryPrompts(): Promise<Record<string, string>> {
  try {
    const db = createAdminClient();
    const { data } = await (db as any)
      .from('platform_settings')
      .select('value')
      .eq('key', 'category_prompts')
      .maybeSingle();
    return (data?.value && typeof data.value === 'object') ? data.value : {};
  } catch {
    return {};
  }
}

export async function getCategoryPrompt(category: string): Promise<string | null> {
  const map = await getCategoryPrompts();
  return map[category] ?? null;
}

export async function getInAppBrowserProtection(): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { data } = await (db as any)
      .from('platform_settings')
      .select('value')
      .eq('key', 'inapp_browser_protection')
      .maybeSingle();
    if (data === null || data === undefined) return true;
    return data.value !== false;
  } catch {
    return true;
  }
}

export async function updatePlatformSetting(key: string, value: unknown) {
  const db = createAdminClient();
  return (db as any)
    .from('platform_settings')
    .upsert({ key, value }, { onConflict: 'key' });
}

export async function getSipProviderIps(): Promise<string[]> {
  try {
    const db = createAdminClient();
    const { data } = await (db as any)
      .from('platform_settings')
      .select('value')
      .eq('key', 'sip_provider_ips')
      .maybeSingle();
    return Array.isArray(data?.value) ? data.value : [];
  } catch {
    return [];
  }
}
