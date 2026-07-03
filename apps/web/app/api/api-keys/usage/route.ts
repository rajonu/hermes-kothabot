import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await (db as any)
    .from('api_usage_logs')
    .select('endpoint, method, status_code, duration_ms, created_at')
    .eq('shop_id', shop.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  const total = logs?.length ?? 0;
  const errors = logs?.filter((l: any) => l.status_code >= 400).length ?? 0;
  const avgDuration = total
    ? Math.round(logs!.reduce((s: number, l: any) => s + (l.duration_ms ?? 0), 0) / total)
    : 0;

  // Requests per endpoint
  const byEndpoint: Record<string, number> = {};
  for (const l of logs ?? []) {
    byEndpoint[l.endpoint] = (byEndpoint[l.endpoint] ?? 0) + 1;
  }

  return NextResponse.json({
    period: '30d',
    total_requests: total,
    error_requests: errors,
    success_rate: total ? Math.round(((total - errors) / total) * 100) : 100,
    avg_duration_ms: avgDuration,
    by_endpoint: byEndpoint,
    recent: logs?.slice(0, 20) ?? [],
  });
}
