/**
 * Backup Cron Endpoint
 * Called by external scheduler:
 *   - Daily:  POST /api/backup/cron  Header: X-Cron-Secret + X-Backup-Type: daily
 *   - Weekly: POST /api/backup/cron  Header: X-Cron-Secret + X-Backup-Type: weekly
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const MAX_BACKUPS = 5;

async function gatherShopData(db: any, shopId: string) {
  const [
    { data: shop }, { data: products }, { data: trainingData },
    { data: knowledgeSources }, { data: knowledgeChunks },
    { data: orders }, { data: customers }, { data: subscription },
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
  return { version: '1.0', shop_id: shopId, exported_at: new Date().toISOString(),
    shop, products: products ?? [], training_data: trainingData ?? [],
    knowledge_sources: knowledgeSources ?? null, knowledge_chunks: knowledgeChunks ?? [],
    orders: orders ?? [], customers: customers ?? [], subscription: subscription ?? null };
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    const type = req.headers.get('x-backup-type') ?? 'daily';
    const expectedSecret = process.env.BACKUP_CRON_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['daily', 'weekly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const db = createAdminClient() as any;

    // Get every shop (onboarding_done flag is never set in practice — back up everyone).
    const { data: shops } = await db.from('shops').select('id, name');
    if (!shops?.length) return NextResponse.json({ message: 'No shops', count: 0 });

    let succeeded = 0, failed = 0;

    for (const shop of shops) {
      try {
        const backupData = await gatherShopData(db, shop.id);
        const dataStr = JSON.stringify(backupData);
        const sizeBytes = Buffer.byteLength(dataStr, 'utf8');

        // Enforce retention before inserting
        const { data: existing } = await db
          .from('backups').select('id')
          .eq('shop_id', shop.id)
          .not('backup_type', 'eq', 'pre_restore')
          .order('created_at', { ascending: false });

        if (existing && existing.length >= MAX_BACKUPS) {
          const toDelete = existing.slice(MAX_BACKUPS - 1).map((b: any) => b.id);
          await db.from('backups').delete().in('id', toDelete);
        }

        const { data: backup } = await db.from('backups').insert({
          shop_id: shop.id,
          backup_type: type,
          created_by: 'system',
          status: 'completed',
          size_bytes: sizeBytes,
          data: backupData,
        }).select('id').single();

        await db.from('backup_logs').insert({
          shop_id: shop.id,
          backup_id: backup?.id,
          action: 'created',
          backup_type: type,
          performed_by: 'system',
          notes: `Automatic ${type} backup`,
        });

        succeeded++;
      } catch {
        failed++;
        await db.from('backup_logs').insert({
          shop_id: shop.id,
          action: 'failed',
          backup_type: type,
          performed_by: 'system',
          notes: `Auto ${type} backup failed`,
        });
      }
    }

    return NextResponse.json({ message: `${type} backup complete`, succeeded, failed });
  } catch (err: any) {
    console.error('Cron backup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
