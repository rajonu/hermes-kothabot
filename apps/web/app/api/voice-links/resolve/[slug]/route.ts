import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: shop, error } = await (db as any)
      .from('shops')
      .select('id, name, public_slug, public_access_enabled, public_page_title, public_page_description, widget_config, ai_config')
      .eq('public_slug', slug)
      .single();

    if (error || !shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!shop.public_access_enabled) {
      return NextResponse.json({ error: 'This voice link is disabled' }, { status: 403 });
    }

    // Return only safe, public-facing fields — never expose widgetId or owner_id
    return NextResponse.json({
      shopName: shop.name,
      themeColor: shop.widget_config?.primaryColor ?? '#10b981',
      greetingMessage: shop.widget_config?.greeting ?? null,
      avatar: shop.ai_config?.avatar ?? null,
      title: shop.public_page_title ?? shop.name,
      description: shop.public_page_description ?? 'Talk to our AI assistant',
      // shopId is intentionally omitted here; the page server component uses admin client directly
    });
  } catch (err) {
    console.error('[voice-links/resolve] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
