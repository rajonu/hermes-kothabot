import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const backupId = searchParams.get('id');
  if (!backupId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // ── Allow either: god admin (PIN session) OR shop owner ──
  const adminSession = await getAdminSession();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!adminSession && !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = (adminSession ? createAdminClient() : supabase) as any;

  const { data: backup } = await db
    .from('backups')
    .select('id, shop_id, backup_type, created_at, data')
    .eq('id', backupId)
    .single();

  if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

  // Owner check is only for non-admin downloads
  if (!adminSession) {
    if (backup.shop_id) {
      const { data: shop } = await db.from('shops').select('id').eq('id', backup.shop_id).eq('owner_id', user!.id).single();
      if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      // Platform backups: admin-only
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const filename = `kothabot-backup-${backup.backup_type}-${new Date(backup.created_at).toISOString().split('T')[0]}.json`;
  const json = JSON.stringify(backup.data, null, 2);

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
