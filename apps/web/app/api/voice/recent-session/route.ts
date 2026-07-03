import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Returns the most recent incomplete voice session transcript for a shop
// (within last 30 minutes, no confirmed order) so it can be injected as
// context when the user calls back after a dropped call.
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId');
  if (!shopId) return NextResponse.json({ transcript: null });

  const db = createAdminClient() as any;
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data } = await db
    .from('voice_sessions')
    .select('id, transcript, duration_s, created_at')
    .eq('shop_id', shopId)
    .eq('status', 'ended')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.transcript?.length) return NextResponse.json({ transcript: null });

  // Only resume if session had real back-and-forth (customer spoke at least twice)
  // and lasted more than 20 seconds — avoids injecting greeting-only sessions
  const customerTurns = data.transcript.filter((t: any) => t.role === 'user' && t.text?.trim().length > 3);
  if (customerTurns.length < 2) return NextResponse.json({ transcript: null });
  if ((data.duration_s ?? 0) < 20) return NextResponse.json({ transcript: null });

  return NextResponse.json({
    sessionId: data.id,
    transcript: data.transcript,
    duration:   data.duration_s,
    createdAt:  data.created_at,
  });
}
