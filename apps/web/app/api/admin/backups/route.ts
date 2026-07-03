import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const db = createAdminClient() as any;
  const { searchParams } = new URL(req.url);
  const shopId = searchParams.get('shopId');
  const tab = searchParams.get('tab') ?? 'all'; // all | platform | logs

  if (shopId) {
    // Client-specific backups
    const [{ data: backups }, { data: logs }] = await Promise.all([
      db.from('backups').select('id, shop_id, backup_type, label, status, size_bytes, created_by, created_at')
        .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(20),
      db.from('backup_logs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(50),
    ]);
    return NextResponse.json({ backups: backups ?? [], logs: logs ?? [] });
  }

  // All backups overview
  const [{ data: backups }, { data: logs }, { count: total }] = await Promise.all([
    db.from('backups').select('id, shop_id, backup_type, label, status, size_bytes, created_by, created_at')
      .order('created_at', { ascending: false }).limit(50),
    db.from('backup_logs').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('backups').select('*', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({ backups: backups ?? [], logs: logs ?? [], total });
}

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
  return {
    version: '1.0', shop_id: shopId, exported_at: new Date().toISOString(),
    shop, products: products ?? [], training_data: trainingData ?? [],
    knowledge_sources: knowledgeSources ?? null, knowledge_chunks: knowledgeChunks ?? [],
    orders: orders ?? [], customers: customers ?? [], subscription: subscription ?? null,
  };
}

async function restoreShopPayload(db: any, shopId: string, payload: any) {
  // Pre-restore safety snapshot
  const safety = await gatherShopData(db, shopId);
  await db.from('backups').insert({
    shop_id: shopId, backup_type: 'pre_restore', created_by: 'admin',
    status: 'completed', size_bytes: Buffer.byteLength(JSON.stringify(safety)),
    data: safety, label: `Pre-restore safety (admin) — ${new Date().toLocaleString()}`,
  });

  if (payload.shop) {
    const { id: _id, owner_id: _o, created_at: _c, ...shopFields } = payload.shop;
    await db.from('shops').update({ ...shopFields, updated_at: new Date().toISOString() }).eq('id', shopId);
  }
  if (payload.products?.length) {
    await db.from('products').delete().eq('shop_id', shopId);
    await db.from('products').insert(payload.products.map(({ id: _, ...p }: any) => ({ ...p, shop_id: shopId })));
  }
  if (payload.training_data?.length) {
    await db.from('training_data').delete().eq('shop_id', shopId);
    await db.from('training_data').insert(payload.training_data.map(({ id: _, ...r }: any) => ({ ...r, shop_id: shopId })));
  }
  await db.from('knowledge_chunks').delete().eq('shop_id', shopId);
  await db.from('knowledge_sources').delete().eq('shop_id', shopId);
  if (payload.knowledge_sources) {
    const { id: _, ...ks } = payload.knowledge_sources;
    await db.from('knowledge_sources').insert({ ...ks, shop_id: shopId });
  }
  if (payload.knowledge_chunks?.length) {
    await db.from('knowledge_chunks').insert(payload.knowledge_chunks.map(({ id: _, ...c }: any) => ({ ...c, shop_id: shopId })));
  }
  if (payload.customers?.length) {
    await db.from('customers').delete().eq('shop_id', shopId);
    await db.from('customers').insert(payload.customers.map(({ id: _, ...c }: any) => ({ ...c, shop_id: shopId })));
  }
  if (payload.orders?.length) {
    await db.from('orders').delete().eq('shop_id', shopId);
    await db.from('orders').insert(payload.orders.map(({ id: _, ...o }: any) => ({ ...o, shop_id: shopId })));
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const db = createAdminClient() as any;
  const body = await req.json();
  const { action, shopId, backupId, payload, label } = body;

  if (action === 'delete' && backupId) {
    await db.from('backups').delete().eq('id', backupId);
    await db.from('backup_logs').insert({
      backup_id: backupId,
      shop_id: shopId ?? null,
      action: 'deleted',
      performed_by: 'admin',
      notes: 'Manually deleted by admin',
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'create_platform') {
    // Full platform backup
    const [
      { data: shops }, { data: subscriptions },
      { data: supportTickets }, { data: platformSettings },
    ] = await Promise.all([
      db.from('shops').select('*').limit(1000),
      db.from('subscriptions').select('*').limit(1000),
      db.from('support_tickets').select('id, shop_id, subject, status, created_at').limit(1000),
      db.from('platform_settings').select('*'),
    ]);

    const payload = {
      version: '1.0',
      type: 'platform',
      exported_at: new Date().toISOString(),
      shops: shops ?? [],
      subscriptions: subscriptions ?? [],
      support_tickets_count: supportTickets?.length ?? 0,
      platform_settings: platformSettings ?? [],
    };

    const str = JSON.stringify(payload);
    const { data: backup } = await db.from('backups').insert({
      shop_id: null,
      backup_type: 'platform',
      created_by: 'admin',
      status: 'completed',
      size_bytes: Buffer.byteLength(str, 'utf8'),
      data: payload,
      label: `Platform backup ${new Date().toLocaleDateString()}`,
    }).select('id, created_at, size_bytes').single();

    await db.from('backup_logs').insert({
      backup_id: backup?.id,
      action: 'created',
      backup_type: 'platform',
      performed_by: 'admin',
      notes: 'Full platform backup created by admin',
    });

    return NextResponse.json({ success: true, backup });
  }

  if (action === 'restore_for_client' && backupId && shopId) {
    const { data: backup } = await db.from('backups').select('*').eq('id', backupId).eq('shop_id', shopId).single();
    if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    await restoreShopPayload(db, shopId, backup.data);
    await db.from('backup_logs').insert({
      shop_id: shopId, backup_id: backupId, action: 'restored',
      backup_type: backup.backup_type, performed_by: 'admin',
      notes: `Restored by admin from backup created at ${backup.created_at}`,
    });
    return NextResponse.json({ success: true });
  }

  // ── Admin creates a backup for a single client ──────────────────────────
  if (action === 'create_for_client' && shopId) {
    const { data: shop } = await db.from('shops').select('id, name').eq('id', shopId).single();
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    const data = await gatherShopData(db, shopId);
    const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
    const { data: backup } = await db.from('backups').insert({
      shop_id: shopId, backup_type: 'manual', created_by: 'admin',
      status: 'completed', size_bytes: size, data,
      label: label || `Admin manual backup — ${shop.name}`,
    }).select('id, created_at, size_bytes').single();
    await db.from('backup_logs').insert({
      shop_id: shopId, backup_id: backup?.id, action: 'created',
      backup_type: 'manual', performed_by: 'admin',
      notes: 'Manual backup created by admin',
    });
    return NextResponse.json({ success: true, backup });
  }

  // ── Admin: backup every client at once ──────────────────────────────────
  if (action === 'create_all_clients') {
    const { data: shops } = await db.from('shops').select('id, name');
    const results: { shopId: string; name: string; success: boolean; error?: string }[] = [];
    for (const s of (shops ?? [])) {
      try {
        const data = await gatherShopData(db, s.id);
        const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
        const { data: backup } = await db.from('backups').insert({
          shop_id: s.id, backup_type: 'manual', created_by: 'admin',
          status: 'completed', size_bytes: size, data,
          label: `Bulk admin backup — ${s.name}`,
        }).select('id').single();
        await db.from('backup_logs').insert({
          shop_id: s.id, backup_id: backup?.id, action: 'created',
          backup_type: 'manual', performed_by: 'admin', notes: 'Bulk admin backup (all clients)',
        });
        results.push({ shopId: s.id, name: s.name, success: true });
      } catch (e: any) {
        results.push({ shopId: s.id, name: s.name, success: false, error: e?.message ?? 'failed' });
      }
    }
    return NextResponse.json({ success: true, total: results.length, results });
  }

  // ── Admin: restore from an uploaded JSON payload ────────────────────────
  if (action === 'restore_from_upload' && shopId && payload) {
    const { data: shop } = await db.from('shops').select('id, name').eq('id', shopId).single();
    if (!shop) return NextResponse.json({ error: 'Target shop not found' }, { status: 404 });
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid backup payload' }, { status: 400 });
    }
    // Also persist the uploaded backup so it appears in the history
    const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    const { data: uploadedBackup } = await db.from('backups').insert({
      shop_id: shopId, backup_type: 'manual', created_by: 'admin',
      status: 'completed', size_bytes: size, data: payload,
      label: `Uploaded backup → ${shop.name}`,
    }).select('id').single();

    await restoreShopPayload(db, shopId, payload);

    await db.from('backup_logs').insert({
      shop_id: shopId, backup_id: uploadedBackup?.id, action: 'restored',
      backup_type: 'manual', performed_by: 'admin',
      notes: `Restored by admin from uploaded JSON file`,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
