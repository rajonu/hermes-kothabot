import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface PushPayload {
  shopId: string;
  title:  string;
  body:   string;
  url:    string;
  tag:    string;
}

export async function POST(req: Request) {
  // Internal-only — called from other server-side routes, not from the browser
  const authHeader = req.headers.get('authorization');
  const internalToken = process.env.INTERNAL_API_SECRET;
  if (!internalToken || authHeader !== `Bearer ${internalToken}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload: PushPayload = await req.json();
  if (!payload.shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });

  const db = createAdminClient() as any;
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('shop_id', payload.shopId);

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const message = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    icon:  '/kotha-logo.png',
    badge: '/icons/badge-72.png',
    tag:   payload.tag,
    url:   payload.url,
  });

  const results = await Promise.allSettled(
    subs.map((s: any) =>
      webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
        message,
      )
    )
  );

  // Remove expired/invalid subscriptions (410 Gone)
  const deadEndpoints = subs
    .filter((_: any, i: number) => {
      const r = results[i];
      return r.status === 'rejected' && (r.reason as any)?.statusCode === 410;
    })
    .map((s: any) => s.endpoint);

  if (deadEndpoints.length) {
    await db.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return NextResponse.json({ sent });
}
