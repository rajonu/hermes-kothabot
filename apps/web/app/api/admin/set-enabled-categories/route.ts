import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';
import { updatePlatformSetting } from '@/lib/platform-settings';
import { ALL_CATEGORY_VALUES } from '@/lib/categories.config';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { categories } = await req.json();
  if (!Array.isArray(categories) || categories.some(c => !ALL_CATEGORY_VALUES.includes(c))) {
    return NextResponse.json({ error: 'Invalid categories' }, { status: 400 });
  }
  if (categories.length === 0) {
    return NextResponse.json({ error: 'At least one category must be enabled' }, { status: 400 });
  }

  const { error } = await updatePlatformSetting('enabled_categories', categories);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
