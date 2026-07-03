import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUrl } from '@/lib/google-calendar';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  // State encodes shop_id for the callback
  const state = Buffer.from(JSON.stringify({ shopId: shop.id, userId: user.id })).toString('base64url');
  const url = getAuthUrl(state);

  return NextResponse.redirect(url);
}
