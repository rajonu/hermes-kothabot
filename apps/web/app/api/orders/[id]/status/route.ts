import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Use the public app URL for redirects — req.url may resolve to internal Railway port
function appUrl(req: NextRequest, path: string): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL
    ?? `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('x-forwarded-host') ?? req.headers.get('host')}`;
  return new URL(path, base);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(appUrl(req, '/login'));
  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.redirect(appUrl(req, '/dashboard'));

  const form = await req.formData();
  const status = form.get('status')?.toString();
  if (!status) return NextResponse.redirect(appUrl(req, `/orders/${id}`));

  await (supabase as any).from('orders').update({ status }).eq('id', id).eq('shop_id', shop.id);
  return NextResponse.redirect(appUrl(req, `/orders/${id}`), 303);
}
