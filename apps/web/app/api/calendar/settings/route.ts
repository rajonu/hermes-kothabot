import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const allowed = ['auto_sync', 'sync_updates', 'sync_cancels', 'calendar_id'];
  const updates: Record<string, any> = {};
  for (const k of allowed) {
    if (k in body) updates[k] = body[k];
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 422 });
  }

  const db = createAdminClient();
  const { error } = await (db as any)
    .from('calendar_integrations')
    .update(updates)
    .eq('shop_id', shop.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
