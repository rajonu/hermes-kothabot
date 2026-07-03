import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const db = createAdminClient() as any;
  const { data: conversation } = await db
    .from('omni_conversations').select('id').eq('id', id).eq('shop_id', shop.id).single();
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  const { error } = await db.from('omni_conversations').update({
    is_ai_paused: false,
    paused_at: null,
    pause_reason: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
