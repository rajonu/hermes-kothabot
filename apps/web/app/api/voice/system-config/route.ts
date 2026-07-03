import { NextResponse } from 'next/server';
import { getSipProviderIps } from '@/lib/platform-settings';

export async function GET(req: Request) {
  // Basic security token verification (same as telephony-sync)
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  const expectedToken = process.env.GATEWAY_TOKEN || 'kothabot-voip-secret-token-2026';

  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sipIps = await getSipProviderIps();
  
  return NextResponse.json({ sipIps });
}
