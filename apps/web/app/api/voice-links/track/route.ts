import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, event } = body as { slug?: string; event?: string };

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const ALLOWED_EVENTS = new Set([
      'visit', 'voice_start',
      'inapp_detected', 'inapp_safari_shown', 'inapp_open_chrome', 'inapp_continue_anyway',
    ]);
    const eventType = event && ALLOWED_EVENTS.has(event) ? event : 'visit';

    const db = createAdminClient();

    // Look up shop by slug
    const { data: shop } = await (db as any)
      .from('shops')
      .select('id')
      .eq('public_slug', slug)
      .eq('public_access_enabled', true)
      .single();

    if (!shop) {
      // Silently succeed — don't expose whether slug exists
      return NextResponse.json({ ok: true });
    }

    const userAgent = req.headers.get('user-agent') ?? undefined;
    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : undefined;

    await (db as any).from('public_link_visits').insert({
      shop_id: shop.id,
      slug,
      event_type: eventType,
      user_agent: userAgent ?? null,
      ip_address: ipAddress ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[voice-links/track] error:', err);
    // Always return 200 for tracking — don't break client UX
    return NextResponse.json({ ok: true });
  }
}
