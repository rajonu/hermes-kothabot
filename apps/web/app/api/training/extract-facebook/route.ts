import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Facebook cannot be auto-scraped — requires JS rendering and blocks bots.
// This route accepts manually pasted Facebook page info instead.

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { shopId, manualText } = await req.json();
    if (!shopId || !manualText?.trim()) {
      return NextResponse.json({ error: 'Missing shopId or content' }, { status: 400 });
    }

    const db = supabase as any;

    // Check one-time limit
    const { data: existing } = await db
      .from('knowledge_sources')
      .select('id, facebook_status')
      .eq('shop_id', shopId)
      .eq('facebook_status', 'completed')
      .single();

    if (existing) {
      return NextResponse.json({
        error: 'Facebook info already saved. Contact support to update.',
        alreadyExtracted: true,
      }, { status: 409 });
    }

    const content = `## Facebook Page Info\n${manualText.trim()}`;
    const wordCount = content.split(/\s+/).length;

    // Delete old facebook chunks
    await db.from('knowledge_chunks').delete()
      .eq('shop_id', shopId)
      .eq('source_type', 'facebook');

    // Store as knowledge chunk
    await db.from('knowledge_chunks').insert({
      shop_id: shopId,
      source_type: 'facebook',
      chunk_type: 'business_summary',
      content,
      word_count: wordCount,
    });

    // Upsert knowledge_sources record
    const { data: src } = await db.from('knowledge_sources').select('id').eq('shop_id', shopId).single();
    if (src) {
      await db.from('knowledge_sources').update({
        facebook_status: 'completed',
        extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', src.id);
    } else {
      await db.from('knowledge_sources').insert({
        shop_id: shopId,
        facebook_status: 'completed',
        extraction_status: 'completed',
        extracted_at: new Date().toISOString(),
        extracted_by: 'system',
      });
    }

    return NextResponse.json({ success: true, content, wordCount });
  } catch (err: any) {
    console.error('Facebook save error:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to save' }, { status: 500 });
  }
}
