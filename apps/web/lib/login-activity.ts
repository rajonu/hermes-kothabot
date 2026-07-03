import { createAdminClient } from './supabase/server';

// ── Parse browser/OS from user agent ──────────────────────────────────────────
export function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown';

  const browser =
    ua.match(/Edg\/[\d.]+/)    ? 'Edge' :
    ua.match(/OPR\/[\d.]+/)    ? 'Opera' :
    ua.match(/Chrome\/[\d.]+/) ? 'Chrome' :
    ua.match(/Firefox\/[\d.]+/)? 'Firefox' :
    ua.match(/Safari\/[\d.]+/) ? 'Safari' :
    ua.match(/MSIE|Trident/)   ? 'IE' :
    'Unknown Browser';

  const browserVersion = ua.match(/(?:Chrome|Firefox|Safari|Edg|OPR)\/(\d+)/)?.[1] ?? '';

  const os =
    ua.includes('iPhone')  ? 'iPhone' :
    ua.includes('iPad')    ? 'iPad' :
    ua.includes('Android') ? 'Android' :
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Mac OS')  ? 'macOS' :
    ua.includes('Linux')   ? 'Linux' :
    'Unknown OS';

  return `${browser}${browserVersion ? ` ${browserVersion}` : ''} / ${os}`;
}

// ── IP Geolocation via ip-api.com (free, no key, 45 req/min) ──────────────────
interface GeoResult {
  city?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
}

export async function getIpLocation(ip: string): Promise<GeoResult> {
  // Skip private/localhost IPs
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip === '::1') {
    return { city: 'Local', country: 'Development', countryCode: 'DEV' };
  }

  try {
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,countryCode,lat,lon,status`, {
      signal: AbortSignal.timeout(3000), // 3s timeout
    });
    const data = await res.json();
    if (data.status === 'success') {
      return { city: data.city, country: data.country, countryCode: data.countryCode, lat: data.lat, lon: data.lon };
    }
  } catch {
    // Geo lookup is best-effort — never crash the login flow
  }
  return {};
}

// ── Record a login event ───────────────────────────────────────────────────────
export async function recordLoginActivity({
  userId, shopId, ip, userAgent,
}: {
  userId: string;
  shopId?: string | null;
  ip: string;
  userAgent: string;
}) {
  try {
    const [geo] = await Promise.all([getIpLocation(ip)]);
    const browser = parseUserAgent(userAgent);
    const db = createAdminClient();

    await (db as any).from('login_activity').insert({
      user_id:      userId,
      shop_id:      shopId ?? null,
      ip_address:   ip,
      user_agent:   userAgent,
      browser,
      city:         geo.city ?? null,
      country:      geo.country ?? null,
      country_code: geo.countryCode ?? null,
      latitude:     geo.lat ?? null,
      longitude:    geo.lon ?? null,
    });
  } catch (e) {
    console.warn('[login-activity] record failed:', e);
  }
}
