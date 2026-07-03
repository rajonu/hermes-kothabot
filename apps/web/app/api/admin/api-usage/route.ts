import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const db = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await (db as any)
    .from('api_usage_logs')
    .select('shop_id, endpoint, method, status_code, duration_ms, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  const total = logs?.length ?? 0;
  const errors = logs?.filter((l: any) => l.status_code >= 400).length ?? 0;

  const byShop: Record<string, number> = {};
  const byEndpoint: Record<string, number> = {};
  for (const l of logs ?? []) {
    byShop[l.shop_id] = (byShop[l.shop_id] ?? 0) + 1;
    byEndpoint[l.endpoint] = (byEndpoint[l.endpoint] ?? 0) + 1;
  }

  return NextResponse.json({
    period: '7d',
    total_requests: total,
    error_requests: errors,
    by_shop: byShop,
    by_endpoint: byEndpoint,
    recent: logs?.slice(0, 50) ?? [],
  });
}
