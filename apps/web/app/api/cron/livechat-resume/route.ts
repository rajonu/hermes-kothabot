/**
 * Backstop auto-resume for paused live-chat conversations.
 * lib/routing.ts already auto-resumes inline the next time a message comes
 * in after 30 minutes, but a conversation that goes completely silent after
 * being paused would stay paused forever without this sweep.
 *
 * POST/GET /api/cron/livechat-resume
 * Header: X-Cron-Secret: <LIVECHAT_RESUME_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const AUTO_RESUME_MS = 30 * 60 * 1000;

async function run(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.LIVECHAT_RESUME_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as any;
  const cutoff = new Date(Date.now() - AUTO_RESUME_MS).toISOString();

  const { data: stale, error: fetchError } = await db
    .from('omni_conversations')
    .select('id')
    .eq('is_ai_paused', true)
    .lt('paused_at', cutoff);

  if (fetchError) {
    console.error('[livechat-resume] fetch error:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const ids = (stale ?? []).map((c: any) => c.id);
  if (ids.length === 0) {
    return NextResponse.json({ message: 'No stale paused conversations', resumed: 0 });
  }

  const { error: updateError } = await db
    .from('omni_conversations')
    .update({ is_ai_paused: false, paused_at: null, pause_reason: null, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (updateError) {
    console.error('[livechat-resume] update error:', updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Resume sweep complete', resumed: ids.length });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
