import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const backupId = searchParams.get('id');
  const shopId   = searchParams.get('shopId');
  if (!backupId || !shopId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const db = supabase as any;

  // Verify ownership
  const { data: shop } = await db.from('shops').select('id').eq('id', shopId).eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Load the backup to delete
  const { data: backup } = await db.from('backups').select('id, backup_type, created_at').eq('id', backupId).eq('shop_id', shopId).single();
  if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

  // Rule 1: Never delete pre_restore type via client
  if (backup.backup_type === 'pre_restore') {
    return NextResponse.json({ error: 'Pre-restore safety backups cannot be deleted.' }, { status: 403 });
  }

  // Rule 2: Clients cannot delete automatic (daily/weekly) backups
  if (['daily', 'weekly'].includes(backup.backup_type)) {
    return NextResponse.json({ error: 'Automatic backups cannot be deleted. Only manual backups can be deleted.' }, { status: 403 });
  }

  // Rule 3: Must keep at least 1 successful backup total
  const { count } = await db.from('backups').select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId).eq('status', 'completed');

  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot delete your only backup. Create a new backup first.' }, { status: 403 });
  }

  // Safe to delete
  await db.from('backups').delete().eq('id', backupId);
  await db.from('backup_logs').insert({
    shop_id: shopId, backup_id: backupId, action: 'deleted',
    backup_type: backup.backup_type, performed_by: `user:${user.id}`,
    notes: 'Manually deleted by client',
  });

  return NextResponse.json({ success: true });
}
