import { headers } from 'next/headers';

export type Region = 'BD' | 'INTL';

/**
 * Detect if the current request is from Bangladesh or international.
 * Uses X-Forwarded-For header + ip-api.com (same service as login-activity).
 * Falls back to 'BD' if detection fails (safe default for local dev).
 */
export async function detectRegion(): Promise<{ region: Region; countryCode: string; country: string }> {
  try {
    const headerMap = await headers();
    const ip = headerMap.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? headerMap.get('x-real-ip')
             ?? '';

    // Local / private IPs → treat as BD (dev environment)
    if (!ip || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
      return { region: 'BD', countryCode: 'BD', country: 'Bangladesh (local)' };
    }

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode`,
      { signal: AbortSignal.timeout(2500), next: { revalidate: 3600 } } // cache 1h
    );
    const data = await res.json();

    if (data.status === 'success') {
      const code   = data.countryCode as string;
      const region: Region = code === 'BD' ? 'BD' : 'INTL';
      return { region, countryCode: code, country: data.country };
    }
  } catch {
    // Geo lookup failed — default to BD (safe fallback)
  }

  return { region: 'BD', countryCode: 'BD', country: 'Bangladesh' };
}

export function formatPrice(amount: number, currency: 'BDT' | 'USD'): string {
  if (amount === 0) return 'Free';
  if (currency === 'BDT') return `৳${amount.toLocaleString('en')}`;
  return `$${(amount / 100).toFixed(2)}`;  // stored in cents for USD
}
