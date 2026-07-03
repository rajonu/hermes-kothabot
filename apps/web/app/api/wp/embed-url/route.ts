/**
 * GET /api/wp/embed-url
 * Bearer API key auth — returns a one-time magic login URL for embedding
 * the KothaBot dashboard inside WordPress admin via iframe.
 *
 * The URL is valid for 30 minutes and auto-logs the shop owner in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../v1/_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const db = createAdminClient();

    // Get the shop owner's email
    const { data: shop } = await (db as any)
      .from('shops')
      .select('owner_id')
      .eq('id', ctx.shopId)
      .single();

    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const { data: { user }, error } = await db.auth.admin.getUserById(shop.owner_id);
    if (error || !user?.email) {
      return NextResponse.json({ error: 'Could not resolve shop owner' }, { status: 500 });
    }

    // Generate a magic link — Supabase creates a one-time OTP link
    const origin = req.headers.get('origin') || 'https://my.kothabot.ai.bd';
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: { redirectTo: `${origin}/dashboard` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
    }

    return NextResponse.json({
      url:        linkData.properties.action_link,
      expires_in: 3600, // Supabase magic links expire in 1 hour
      dashboard:  `${origin}/dashboard`,
    });
  });
}
