import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get('shopId');
  if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

  const db = supabase as any;

  // Verify ownership
  const { data: shop } = await db.from('shops').select('id').eq('id', shopId).eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: backups } = await db
    .from('backups')
    .select('id, backup_type, label, status, size_bytes, created_at, created_by')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: logs } = await db
    .from('backup_logs')
    .select('id, action, backup_type, performed_by, notes, created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(30);

  return NextResponse.json({ backups: backups ?? [], logs: logs ?? [] });
}
