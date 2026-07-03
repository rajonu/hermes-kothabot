import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the authenticated shop
    const { data: shop, error: shopErr } = await (supabase as any)
      .from('shops')
      .select('id, public_slug')
      .eq('owner_id', user.id)
      .single();

    if (shopErr || !shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const db = createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error: statsErr } = await (db as any)
      .from('public_link_visits')
      .select('event_type')
      .eq('shop_id', shop.id)
      .gte('created_at', since);

    if (statsErr) {
      console.error('[voice-links/stats] query error:', statsErr);
      return NextResponse.json({ visits: 0, voiceStarts: 0 });
    }

    const visits = rows?.filter((r: any) => r.event_type === 'visit').length ?? 0;
    const voiceStarts = rows?.filter((r: any) => r.event_type === 'voice_start').length ?? 0;

    return NextResponse.json({ visits, voiceStarts });
  } catch (err) {
    console.error('[voice-links/stats] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
