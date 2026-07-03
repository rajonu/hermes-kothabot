import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 50;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let { slug, title, description, enabled } = body as {
      slug?: string;
      title?: string;
      description?: string;
      enabled?: boolean;
    };

    // Look up the shop
    const { data: shop, error: shopErr } = await (supabase as any)
      .from('shops')
      .select('id, name, public_slug')
      .eq('owner_id', user.id)
      .single();

    if (shopErr || !shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Auto-generate slug from shop name if not provided
    if (!slug) {
      slug = slugify(shop.name);
      // Append shop id suffix to reduce collision chance on auto-generate
      slug = `${slug}-${shop.id.slice(0, 6)}`;
    }

    slug = slug.toLowerCase().trim();

    if (!isValidSlug(slug)) {
      return NextResponse.json(
        { error: 'Slug must be 3–50 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.' },
        { status: 400 }
      );
    }

    // Check uniqueness (allow updating own slug)
    const db = createAdminClient();
    const { data: existing } = await (db as any)
      .from('shops')
      .select('id')
      .eq('public_slug', slug)
      .single();

    if (existing && existing.id !== shop.id) {
      return NextResponse.json({ error: 'This slug is already taken. Please choose another.' }, { status: 409 });
    }

    const updates: Record<string, unknown> = { public_slug: slug };
    if (title !== undefined) updates.public_page_title = title || null;
    if (description !== undefined) updates.public_page_description = description || null;
    if (enabled !== undefined) updates.public_access_enabled = enabled;

    const { error: updateErr } = await (db as any)
      .from('shops')
      .update(updates)
      .eq('id', shop.id);

    if (updateErr) {
      console.error('[voice-links/setup] update error:', updateErr);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    const voiceLinkBase = process.env.NEXT_PUBLIC_VOICE_LINK_URL ?? 'https://call.kothabot.ai.bd';
    const url = `${voiceLinkBase}/${slug}`;
    return NextResponse.json({ slug, url });
  } catch (err) {
    console.error('[voice-links/setup] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
