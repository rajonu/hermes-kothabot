import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';
import { updatePlatformSetting } from '@/lib/platform-settings';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { key, value } = await req.json();
  if (!key || value === undefined) return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });

  const { error } = await updatePlatformSetting(key, value);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
