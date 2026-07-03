import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '30', 10) || 30, 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
  const archived = searchParams.get('archived') === 'true';

  const db = createAdminClient() as any;
  let query = db
    .from('omni_conversations')
    .select('*', { count: 'exact' })
    .eq('shop_id', shop.id);
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);

  const { data, error, count } = await query
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversations: data ?? [], total: count ?? 0, limit, offset });
}
