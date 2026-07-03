import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any)
    .from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const baseUrl = process.env.BOT_SERVER_URL;
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!baseUrl || !secret) {
    return NextResponse.json({ error: 'BOT_SERVER_URL or BOT_INTERNAL_SECRET not configured' }, { status: 500 });
  }

  // Ensure a row exists so the dashboard has something to show while pairing.
  const db = createAdminClient() as any;
  await db.from('clients_channels').upsert(
    { shop_id: shop.id, channel_type: 'whatsapp', is_active: false, updated_at: new Date().toISOString() },
    { onConflict: 'shop_id,channel_type' }
  );

  // ponytail: bot-server restarts (deploys, crash-restarts) are brief but
  // real — a raw fetch failure during one used to leak Node's internal
  // "fetch failed" TypeError straight into a user-facing alert(). One quick
  // retry rides out most of those; anything past that gets a friendly
  // message with the real error logged server-side instead of shown raw.
  const attempts = [0, 1500];
  let lastErr: string | null = null;
  for (const delay of attempts) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(`${baseUrl}/internal/wa-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ shopId: shop.id }),
      });
      if (res.ok) return NextResponse.json({ success: true });
      lastErr = await res.text();
    } catch (err: any) {
      lastErr = err?.message ?? 'unknown error';
    }
  }

  console.error(`[whatsapp/connect] wa-init failed for shop ${shop.id} after retry:`, lastErr);
  return NextResponse.json(
    { error: 'Could not start WhatsApp pairing right now — please try again in a few seconds.' },
    { status: 502 }
  );
}
