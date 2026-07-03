import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = supabase as any;
  const { data: shop } = await db.from('shops').select('id, widget_config').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'shop not found' }, { status: 404 });

  const patch = await req.json() as Partial<{ requirePhone: boolean }>;
  // Allow-list specific fields only — don't let arbitrary JSON overwrite widget_config
  const next = { ...(shop.widget_config ?? {}) };
  if (typeof patch.requirePhone === 'boolean') next.requirePhone = patch.requirePhone;

  const { error } = await db.from('shops').update({ widget_config: next }).eq('id', shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, widget_config: next });
}
