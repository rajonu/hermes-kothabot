import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { exchangeCode, getGoogleProfile, listCalendars } from '@/lib/google-calendar';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/integrations?cal=error&reason=${encodeURIComponent(error ?? 'missing_code')}`);
  }

  let shopId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    shopId = decoded.shopId;
    if (!shopId) throw new Error('no shopId');
  } catch {
    return NextResponse.redirect(`${APP_URL}/integrations?cal=error&reason=invalid_state`);
  }

  try {
    const tokens  = await exchangeCode(code);
    const profile = await getGoogleProfile(tokens.access_token);
    const expiry  = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Pick primary calendar
    const calendars = await listCalendars(tokens.access_token);
    const primary = calendars.find(c => c.primary)?.id ?? 'primary';

    const db = createAdminClient();
    await (db as any).from('calendar_integrations').upsert({
      shop_id:       shopId,
      google_email:  profile.email,
      calendar_id:   primary,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? '',
      token_expiry:  expiry,
      connected_at:  new Date().toISOString(),
      auto_sync:     true,
      sync_updates:  true,
      sync_cancels:  true,
    }, { onConflict: 'shop_id' });

    return NextResponse.redirect(`${APP_URL}/integrations?cal=connected&email=${encodeURIComponent(profile.email)}`);
  } catch (err: any) {
    console.error('[calendar/callback]', err?.message);
    return NextResponse.redirect(`${APP_URL}/integrations?cal=error&reason=${encodeURIComponent('connection_failed')}`);
  }
}
