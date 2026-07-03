/**
 * Auto-archives live-chat conversations idle for 1hr+ — keeps the Live Chat
 * inbox to active threads only. Archived conversations still show up under
 * Live Chat's "Archived" filter.
 *
 * POST/GET /api/cron/livechat-archive
 * Header: X-Cron-Secret: <LIVECHAT_RESUME_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const ARCHIVE_IDLE_MS = 60 * 60 * 1000;

async function run(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.LIVECHAT_RESUME_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as any;
  const cutoff = new Date(Date.now() - ARCHIVE_IDLE_MS).toISOString();

  const { data, error } = await db
    .from('omni_conversations')
    .update({ archived_at: new Date().toISOString() })
    .is('archived_at', null)
    .lt('last_message_at', cutoff)
    .select('id');

  if (error) {
    console.error('[livechat-archive] update error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Archive sweep complete', archived: (data ?? []).length });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
