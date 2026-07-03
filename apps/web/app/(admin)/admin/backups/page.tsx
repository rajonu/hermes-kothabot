export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/server';
import { AdminBackupDashboard } from './AdminBackupDashboard';

export default async function AdminBackupsPage() {
  const db = createAdminClient() as any;

  const [
    { data: backups },
    { data: logs },
    { count: total },
    { data: shops },
  ] = await Promise.all([
    db.from('backups').select('id, shop_id, backup_type, label, status, size_bytes, created_by, created_at')
      .order('created_at', { ascending: false }).limit(200),
    db.from('backup_logs').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('backups').select('*', { count: 'exact', head: true }),
    // Fetch all shops with their owner info for enrichment
    db.from('shops').select('id, name, category').order('name'),
  ]);

  // Fetch owner emails from auth — batch via subscriptions table which has owner_id
  const { data: subs } = await db
    .from('subscriptions')
    .select('shop_id, shops!inner(id, name)')
    .limit(200);

  // Build shop map: id → { name, category }
  const shopMap: Record<string, { name: string; category: string }> = {};
  for (const s of (shops ?? [])) {
    shopMap[s.id] = { name: s.name, category: s.category };
  }

  // Enrich backups with shop name
  const enriched = (backups ?? []).map((b: any) => ({
    ...b,
    shop_name: b.shop_id ? (shopMap[b.shop_id]?.name ?? 'Unknown') : null,
    shop_category: b.shop_id ? (shopMap[b.shop_id]?.category ?? '') : null,
  }));

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Backup Manager</h1>
          <p className="text-sm text-gray-400 mt-0.5">Platform-wide backup management and audit logs.</p>
        </div>

        <AdminBackupDashboard
          backups={enriched}
          logs={logs ?? []}
          total={total ?? 0}
          shops={shops ?? []}
        />
      </div>
    </div>
  );
}
