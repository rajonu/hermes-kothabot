import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';
import { ALL_CATEGORY_VALUES } from '@/lib/categories.config';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, category } = await req.json();
  if (!shopId || !ALL_CATEGORY_VALUES.includes(category)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await (db as any).from('shops').update({ category }).eq('id', shopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
