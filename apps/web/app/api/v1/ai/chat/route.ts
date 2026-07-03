/**
 * POST /api/v1/ai/chat
 * Third-party systems can send a message + conversation history
 * and receive an AI reply using the shop's full 4-layer context.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';
import { runAIReply } from '@/lib/ai-inference';

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: 'message field required' }, { status: 422 });
    }

    const db = createAdminClient();
    const { data: shopRaw } = await (db as any)
      .from('shops').select('*').eq('id', ctx.shopId).single();
    if (!shopRaw) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    const shop = shopRaw as any;

    try {
      const reply = await runAIReply({ shop, history: body.history ?? [], message: body.message });
      return NextResponse.json({ reply, shop_id: ctx.shopId });
    } catch (err: any) {
      return NextResponse.json({ error: 'AI unavailable', detail: err?.message }, { status: 503 });
    }
  });
}
