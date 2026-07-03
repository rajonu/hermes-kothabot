import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

// Cap the stored content so it can never bloat the AI prompt (the voice KB is
// hard-capped at 4 000 chars downstream; 8 000 here leaves room for chat too).
const MAX_CONTENT_CHARS = 8000;
const SOURCE_TYPE = 'wordpress';

// ── PUT /api/v1/knowledge ─────────────────────────────────────────────────────
// Replaces this shop's WordPress knowledge chunk. Body: { content, title? }
export async function PUT(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'content (string) is required' }, { status: 422 });
    }

    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const raw = body.content.trim().slice(0, MAX_CONTENT_CHARS);
    const content = title ? `## ${title}\n${raw}` : raw;
    const wordCount = content.split(/\s+/).length;

    const supabase = createAdminClient();

    // Delete-then-insert this shop's existing WordPress chunk (one per shop)
    await (supabase as any).from('knowledge_chunks').delete()
      .eq('shop_id', ctx.shopId)
      .eq('source_type', SOURCE_TYPE);

    const { error } = await (supabase as any).from('knowledge_chunks').insert({
      shop_id: ctx.shopId,
      source_type: SOURCE_TYPE,
      chunk_type: 'business_summary',
      content,
      word_count: wordCount,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, wordCount, preview: content.slice(0, 300) });
  });
}

// ── DELETE /api/v1/knowledge ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const supabase = createAdminClient();
    const { error } = await (supabase as any).from('knowledge_chunks').delete()
      .eq('shop_id', ctx.shopId)
      .eq('source_type', SOURCE_TYPE);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
