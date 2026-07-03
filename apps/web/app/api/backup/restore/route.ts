import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
  return { version: '1.0', shop_id: shopId, exported_at: new Date().toISOString(),
    shop, products: products ?? [], training_data: trainingData ?? [],
    knowledge_sources: knowledgeSources ?? null, knowledge_chunks: knowledgeChunks ?? [],
    orders: orders ?? [], customers: customers ?? [], subscription: subscription ?? null };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { backupId, shopId } = await req.json();
    if (!backupId || !shopId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = supabase as any;

    // Verify shop ownership
    const { data: shop } = await db.from('shops').select('id, name').eq('id', shopId).eq('owner_id', user.id).single();
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    // Load the backup to restore
    const { data: backup } = await db.from('backups').select('*').eq('id', backupId).eq('shop_id', shopId).single();
    if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

    const payload = backup.data;

    // ── STEP 1: Create pre-restore safety backup ───────────────────────────
    const safetyData = await gatherShopData(db, shopId);
    const safetyStr = JSON.stringify(safetyData);
    const { data: safetyBackup } = await db.from('backups').insert({
      shop_id: shopId,
      backup_type: 'pre_restore',
      created_by: `user:${user.id}`,
      status: 'completed',
      size_bytes: Buffer.byteLength(safetyStr, 'utf8'),
      data: safetyData,
      label: `Pre-restore safety — ${new Date().toLocaleString()}`,
    }).select('id').single();

    await db.from('backup_logs').insert({
      shop_id: shopId,
      backup_id: safetyBackup?.id,
      action: 'pre_restore_created',
      backup_type: 'pre_restore',
      performed_by: `user:${user.id}`,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      notes: `Safety backup before restoring backup ${backupId}`,
    });

    // ── STEP 2: Restore shop profile ──────────────────────────────────────
    if (payload.shop) {
      const { id: _id, owner_id: _o, created_at: _c, ...shopFields } = payload.shop;
      await db.from('shops').update({ ...shopFields, updated_at: new Date().toISOString() }).eq('id', shopId);
    }

    // ── STEP 3: Restore products ──────────────────────────────────────────
    if (payload.products?.length > 0) {
      await db.from('products').delete().eq('shop_id', shopId);
      const products = payload.products.map(({ id: _id, ...p }: any) => ({ ...p, shop_id: shopId }));
      await db.from('products').insert(products);
    }

    // ── STEP 4: Restore training data ─────────────────────────────────────
    if (payload.training_data?.length > 0) {
      await db.from('training_data').delete().eq('shop_id', shopId);
      const rows = payload.training_data.map(({ id: _id, ...r }: any) => ({ ...r, shop_id: shopId }));
      await db.from('training_data').insert(rows);
    }

    // ── STEP 5: Restore knowledge ─────────────────────────────────────────
    await db.from('knowledge_chunks').delete().eq('shop_id', shopId);
    await db.from('knowledge_sources').delete().eq('shop_id', shopId);

    if (payload.knowledge_sources) {
      const { id: _id, ...ks } = payload.knowledge_sources;
      await db.from('knowledge_sources').insert({ ...ks, shop_id: shopId });
    }
    if (payload.knowledge_chunks?.length > 0) {
      const chunks = payload.knowledge_chunks.map(({ id: _id, ...c }: any) => ({ ...c, shop_id: shopId }));
      await db.from('knowledge_chunks').insert(chunks);
    }

    // ── STEP 6: Restore customers ─────────────────────────────────────────
    if (payload.customers?.length > 0) {
      await db.from('customers').delete().eq('shop_id', shopId);
      const custs = payload.customers.map(({ id: _id, ...c }: any) => ({ ...c, shop_id: shopId }));
      await db.from('customers').insert(custs);
    }

    // ── STEP 7: Restore orders ────────────────────────────────────────────
    if (payload.orders?.length > 0) {
      await db.from('orders').delete().eq('shop_id', shopId);
      const ords = payload.orders.map(({ id: _id, ...o }: any) => ({ ...o, shop_id: shopId }));
      await db.from('orders').insert(ords);
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    await db.from('backup_logs').insert({
      shop_id: shopId,
      backup_id: backupId,
      action: 'restored',
      backup_type: backup.backup_type,
      performed_by: `user:${user.id}`,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      notes: `Restored from backup created at ${backup.created_at}`,
    });

    return NextResponse.json({ success: true, safetyBackupId: safetyBackup?.id });
  } catch (err: any) {
    console.error('Restore error:', err);
    return NextResponse.json({ error: err.message ?? 'Restore failed' }, { status: 500 });
  }
}
