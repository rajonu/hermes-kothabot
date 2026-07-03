/**
 * POST /api/internal/ai-reply
 * Internal-only endpoint so the WhatsApp bot-server (separate runtime,
 * can't import Next.js lib files) gets AI replies through the same
 * 4-layer pipeline as the widget/v1 API, instead of duplicating prompt logic.
 *
 * Auth: header x-internal-secret === process.env.BOT_INTERNAL_SECRET
 * Body: { shopId: string, history: Array<{role:'user'|'model', text: string}>, message: string,
 *          audio?: { base64: string, mimeType: string } }
 * `message` may be empty when `audio` (a voice note) is provided — Gemini reads the audio directly.
 * Response: { reply: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runAIReply } from '@/lib/ai-inference';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  const expected = process.env.BOT_INTERNAL_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { shopId, history, message, audio } = body ?? {};
  if (!shopId || (!message?.trim() && !audio?.base64)) {
    return NextResponse.json({ error: 'shopId and message or audio required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: shopRaw } = await (db as any).from('shops').select('*').eq('id', shopId).single();
  if (!shopRaw) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  try {
    const reply = await runAIReply({ shop: shopRaw, history: history ?? [], message: message ?? '', audio });
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[internal/ai-reply] error:', err?.message);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 });
  }
}
