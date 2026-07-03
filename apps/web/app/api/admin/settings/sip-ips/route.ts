import { NextResponse } from 'next/server';
import { updatePlatformSetting } from '@/lib/platform-settings';

export async function POST(req: Request) {
  try {
    const { ips } = await req.json();
    await updatePlatformSetting('sip_provider_ips', ips);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
