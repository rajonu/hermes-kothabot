import { NextRequest, NextResponse } from 'next/server';
import { updatePlatformSetting } from '@/lib/platform-settings';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  try {
    const { enabled } = await req.json();
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 });
    }
    await updatePlatformSetting('inapp_browser_protection', enabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/settings/voice-protection]', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
