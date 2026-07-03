/**
 * Cleanup Expired Voice Transcripts
 * Called daily to delete non-order sessions that have exceeded 7-day retention.
 *
 * POST /api/voice/cleanup-transcripts
 * Header: X-Cron-Secret: <TRANSCRIPT_CLEANUP_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.TRANSCRIPT_CLEANUP_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createAdminClient() as any;

    // ── Find and delete expired non-order sessions ──────────────────────────
    // Criteria: order_linked = false AND archived_at < now
    const { data: expiredSessions, error: fetchError } = await db
      .from('voice_sessions')
      .select('id, shop_id')
      .eq('order_linked', false)
      .lt('archived_at', new Date().toISOString());

    if (fetchError) {
      console.error('[cleanup-transcripts] fetch error:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const expiredIds = expiredSessions?.map((s: any) => s.id) ?? [];
    console.log(`[cleanup-transcripts] found ${expiredIds.length} expired sessions`);

    if (expiredIds.length === 0) {
      return NextResponse.json({ message: 'No expired sessions', deleted: 0 });
    }

    // ── Delete the expired sessions ──────────────────────────────────────
    const { error: deleteError } = await db
      .from('voice_sessions')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('[cleanup-transcripts] delete error:', deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`[cleanup-transcripts] ✅ deleted ${expiredIds.length} expired sessions`);

    // ── Log cleanup in backup_logs (reuse for audit trail) ───────────────
    if (expiredIds.length > 0) {
      await db
        .from('backup_logs')
        .insert({
          action: 'transcript_cleanup',
          backup_type: 'auto',
          performed_by: 'system',
          notes: `Cleaned up ${expiredIds.length} expired non-order transcripts (7-day retention exceeded)`,
        })
        .catch((e: any) => console.warn('[cleanup-transcripts] log error:', e?.message));
    }

    return NextResponse.json({ message: 'Cleanup complete', deleted: expiredIds.length });
  } catch (err: any) {
    console.error('[cleanup-transcripts] unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
