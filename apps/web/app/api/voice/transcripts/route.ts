import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabase as any;

  // Get user's shop
  const { data: shop, error: shopError } = await db
    .from('shops')
    .select('id, category')
    .eq('owner_id', user.id)
    .single();

  if (shopError || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const shopId = shop.id;

  // Query params
  const orderId = req.nextUrl.searchParams.get('orderId');
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

  try {
    if (sessionId) {
      const { data: session, error } = await db
        .from('voice_sessions')
        .select('id, created_at, duration_s, transcript, order_linked, end_reason, off_topic_count, source, caller_did')
        .eq('shop_id', shopId)
        .eq('id', sessionId)
        .single();
      
      if (error || !session) {
        return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
      }
      
      return NextResponse.json({ session, category: shop.category });
    }
    let query = db
      .from('voice_sessions')
      .select('id, created_at, duration_s, transcript, order_linked, end_reason, off_topic_count, source, caller_did', { count: 'exact' })
      .eq('shop_id', shopId);

    // ── Filter: permanent sessions OR not expired yet ────────────────────────
    // order_linked=true → keep forever
    // order_linked=false AND archived_at > now → still within 7-day window
    query = query.or(
      `order_linked.eq.true,and(order_linked.eq.false,archived_at.gt.${new Date().toISOString()})`
    );

    // ── Filter by order if provided ────────────────────────────────────────
    if (orderId) {
      // Join with orders to filter by order_id
      const { data: sessions, error } = await db
        .from('voice_sessions')
        .select('id, created_at, duration_s, transcript, order_linked, end_reason, off_topic_count, source, caller_did')
        .eq('shop_id', shopId)
        .eq('session_id', (
          // Subquery-ish: find session_id from the target order
          await db.from('orders').select('session_id').eq('id', orderId).single()
            .then((r: any) => r.data?.session_id)
        ));

      if (error || !sessions?.length) {
        return NextResponse.json({ error: 'Order or transcript not found' }, { status: 404 });
      }

      return NextResponse.json({ sessions });
    }

    // ── Default: list all transcripts (with retention logic applied) ────────
    const { data: sessions, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[transcripts] query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sessions: sessions ?? [],
      total: count ?? 0,
      limit,
      offset,
      category: shop.category,
    });
  } catch (err: any) {
    console.error('[transcripts] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
