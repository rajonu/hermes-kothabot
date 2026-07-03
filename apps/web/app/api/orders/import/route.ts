import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { shopId, rows } = await req.json();
  if (!shopId || !Array.isArray(rows)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  // Verify shop belongs to user
  const db = supabase as any;
  const { data: shop } = await db.from('shops').select('id').eq('id', shopId).eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 403 });

  const records = rows
    .filter(r => r.customer || r.name || r.phone)
    .map(r => ({
      shop_id:      shopId,
      type:         r.type || 'appointment',
      status:       r.status || 'pending',
      total_amount: r.amount ? parseFloat(r.amount) : null,
      notes:        [r.customer || r.name ? `Name: ${r.customer || r.name}` : null, r.phone ? `Phone: ${r.phone}` : null, r.notes || null].filter(Boolean).join(' | ') || null,
      items:        [],
    }));

  if (!records.length) return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });

  const { error, count } = await db.from('orders').insert(records, { count: 'exact' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count });
}
