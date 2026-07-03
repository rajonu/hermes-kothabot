import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { exchangeCode, getLongLivedToken, getPages, subscribeApp } from '@/lib/facebook';
import { encryptSecret } from '@/lib/crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/integrations?fb=error&reason=${encodeURIComponent(error ?? 'missing_code')}`);
  }

  let shopId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    shopId = decoded.shopId;
    if (!shopId) throw new Error('no shopId');
  } catch {
    return NextResponse.redirect(`${APP_URL}/integrations?fb=error&reason=invalid_state`);
  }

  try {
    const { access_token: shortLivedToken } = await exchangeCode(code);
    const longLivedToken = await getLongLivedToken(shortLivedToken);
    const pages = await getPages(longLivedToken);

    // v1: take the first page. Multi-page selection can be added to the UI later.
    const page = pages[0];
    if (!page) {
      return NextResponse.redirect(`${APP_URL}/integrations?fb=error&reason=no_pages`);
    }

    await subscribeApp(page.id, page.access_token);

    const db = createAdminClient();
    await (db as any).from('clients_channels').upsert({
      shop_id: shopId,
      channel_type: 'facebook',
      fb_page_id: page.id,
      fb_page_name: page.name,
      fb_page_access_token: encryptSecret(page.access_token),
      is_active: true,
      connected_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'shop_id,channel_type' });

    return NextResponse.redirect(`${APP_URL}/integrations?fb=connected&page=${encodeURIComponent(page.name)}`);
  } catch (err: any) {
    console.error('[integrations/facebook/callback]', err?.message);
    return NextResponse.redirect(`${APP_URL}/integrations?fb=error&reason=connection_failed`);
  }
}
