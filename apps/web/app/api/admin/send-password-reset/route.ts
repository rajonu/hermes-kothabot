import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId } = await req.json();
  if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

  const db = createAdminClient();

  const { data: shop } = await (db as any).from('shops').select('owner_id').eq('id', shopId).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { data: authUser, error: authErr } = await db.auth.admin.getUserById(shop.owner_id);
  if (authErr || !authUser?.user?.email) {
    return NextResponse.json({ error: 'Could not find user email' }, { status: 500 });
  }

  // Use admin client to send reset — no user session required
  const { error } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: authUser.user.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings` },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, email: authUser.user.email });
}
