import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId } = await req.json();
  if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

  const db = createAdminClient();

  // Get the shop owner's user ID
  const { data: shop } = await (db as any).from('shops').select('owner_id').eq('id', shopId).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Get the owner's email from Supabase auth
  const { data: authUser, error: authErr } = await db.auth.admin.getUserById(shop.owner_id);
  if (authErr || !authUser?.user?.email) {
    return NextResponse.json({ error: 'Could not find user email' }, { status: 500 });
  }

  // Prefer the configured app URL — never fall back to localhost on production
  const host = req.headers.get('host') ?? 'web-production-64818.up.railway.app';
  const appUrl: string = process.env.NEXT_PUBLIC_APP_URL
    ?? (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);

  // Generate a magic link (one-time login, expires in 1 hour)
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: authUser.user.email,
    options: { redirectTo: `${appUrl}/login` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? 'Failed to generate link' }, { status: 500 });
  }

  return NextResponse.json({
    email: authUser.user.email,
    link: linkData.properties.action_link,
  });
}
