import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_BACKUPS = 5; // keep latest 5 (excludes pre_restore type)

async function gatherShopData(db: any, shopId: string) {
  const [
    { data: shop },
    { data: products },
    { data: trainingData },
    { data: knowledgeSources },
    { data: knowledgeChunks },
    { data: orders },
    { data: customers },
    { data: subscription },
  ] = await Promise.all([
    db.from('shops').select('*').eq('id', shopId).single(),
    db.from('products').select('*').eq('shop_id', shopId),
    db.from('training_data').select('*').eq('shop_id', shopId),
    db.from('knowledge_sources').select('*').eq('shop_id', shopId).single(),
    db.from('knowledge_chunks').select('*').eq('shop_id', shopId),
    db.from('orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(500),
    db.from('customers').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(500),
    db.from('subscriptions').select('*').eq('shop_id', shopId).single(),
  ]);

  return {
    version: '1.0',
    shop_id: shopId,
    exported_at: new Date().toISOString(),
    shop,
    products: products ?? [],
    training_data: trainingData ?? [],
    knowledge_sources: knowledgeSources ?? null,
    knowledge_chunks: knowledgeChunks ?? [],
    orders: orders ?? [],
    customers: customers ?? [],
    subscription: subscription ?? null,
  };
}

async function enforceRetention(db: any, shopId: string) {
  // Count non-pre_restore backups
  const { data: existing } = await db
    .from('backups')
    .select('id, created_at')
    .eq('shop_id', shopId)
    .not('backup_type', 'eq', 'pre_restore')
    .order('created_at', { ascending: false });

  if (!existing || existing.length < MAX_BACKUPS) return;

  // Delete oldest beyond limit
  const toDelete = existing.slice(MAX_BACKUPS - 1).map((b: any) => b.id);
  if (toDelete.length > 0) {
    await db.from('backups').delete().in('id', toDelete);
    await db.from('backup_logs').insert(
      toDelete.map((id: string) => ({
        shop_id: shopId,
        backup_id: id,
        action: 'deleted',
        backup_type: 'rotation',
        performed_by: 'system',
        notes: 'Auto-deleted by retention policy (max 5)',
      }))
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { shopId, label, backupType = 'manual' } = await req.json();
    if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

    const db = supabase as any;

    // Verify shop ownership
    const { data: shop } = await db.from('shops').select('id, name').eq('id', shopId).eq('owner_id', user.id).single();
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    // Gather all data
    const backupData = await gatherShopData(db, shopId);
    const dataStr = JSON.stringify(backupData);
    const sizeBytes = Buffer.byteLength(dataStr, 'utf8');

    // Enforce retention (before inserting new one)
    await enforceRetention(db, shopId);

    // Insert backup
    const { data: backup, error } = await db
      .from('backups')
      .insert({
        shop_id: shopId,
        backup_type: backupType,
        created_by: `user:${user.id}`,
        status: 'completed',
        size_bytes: sizeBytes,
        data: backupData,
        label: label || null,
      })
      .select('id, backup_type, created_at, size_bytes, status')
      .single();

    if (error) throw error;

    // Audit log
    await db.from('backup_logs').insert({
      shop_id: shopId,
      backup_id: backup.id,
      action: 'created',
      backup_type: backupType,
      performed_by: `user:${user.id}`,
      ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      notes: label || null,
    });

    return NextResponse.json({ success: true, backup });
  } catch (err: any) {
    console.error('Backup create error:', err);
    return NextResponse.json({ error: err.message ?? 'Backup failed' }, { status: 500 });
  }
}
