import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOAuthUrl } from '@/lib/facebook';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const state = Buffer.from(JSON.stringify({ shopId: shop.id, userId: user.id })).toString('base64url');
  const url = getOAuthUrl(state);

  return NextResponse.redirect(url);
}
