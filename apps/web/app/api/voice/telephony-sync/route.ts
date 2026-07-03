import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  // Basic security token verification
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  // TODO(security): set GATEWAY_TOKEN on both web .env.local and bridge .env, then remove this fallback
  if (!process.env.GATEWAY_TOKEN) {
    console.warn('[telephony-sync] GATEWAY_TOKEN env not set — using insecure default token');
  }
  const expectedToken = process.env.GATEWAY_TOKEN || 'kothabot-voip-secret-token-2026';

  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  // Filter to active-telephony shops in SQL instead of fetching every shop
  const { data: shops, error } = await (supabase as any)
    .from('shops')
    .select('id, name, ai_config')
    .eq('ai_config->telephony->>status', 'active');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activeTelephonyShops = (shops ?? [])
    .map((shop: any) => ({
      // SIP trunk config
      shopId: shop.id,
      shopName: shop.name,
      number: shop.ai_config.telephony.number,
      host: shop.ai_config.telephony.host,
      username: shop.ai_config.telephony.username,
      password: shop.ai_config.telephony.password,
      channels: shop.ai_config.telephony.channels ?? 3,
      // Full AI config for voice server
      systemPrompt: shop.ai_config?.systemPrompt ?? '',
      greetingMessage: shop.ai_config?.greetingMessage ?? '',
      trainingData: shop.ai_config?.trainingData ?? '',
      language: shop.ai_config?.language ?? 'bn',
      voice: shop.ai_config?.voice ?? 'Aoede',
      aiModel: shop.ai_config?.aiModel ?? '',
      category: shop.ai_config?.category ?? '',
      collectFields: shop.ai_config?.collectFields ?? { name: true, phone: true, address: true },
    }));

  return NextResponse.json({ shops: activeTelephonyShops });
}
