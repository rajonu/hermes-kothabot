import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import { updatePlatformSetting } from '@/lib/platform-settings';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { rules } = await req.json();
  if (typeof rules !== 'string') return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  await updatePlatformSetting('global_ai_rules', rules);
  return NextResponse.json({ success: true });
}
