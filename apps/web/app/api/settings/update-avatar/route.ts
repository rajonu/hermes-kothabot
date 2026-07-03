import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { avatar } = await req.json(); // base64 data URL or null to remove
  const { data: shop } = await (supabase as any).from('shops').select('id, ai_config').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { error } = await (supabase as any)
    .from('shops')
    .update({ ai_config: { ...(shop.ai_config ?? {}), avatar } })
    .eq('id', shop.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
