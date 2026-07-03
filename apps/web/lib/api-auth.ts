import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface ApiContext {
  shopId: string;
  keyId: string;
  keyType: 'test' | 'live';
}

/** Extract + validate API key from Authorization header. Returns context or error response. */
export async function validateApiKey(
  req: NextRequest
): Promise<{ ctx: ApiContext; error?: never } | { ctx?: never; error: NextResponse }> {
  const authHeader = req.headers.get('authorization') ?? '';
  const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!raw || (!raw.startsWith('kb_live_') && !raw.startsWith('kb_test_'))) {
    return {
      error: NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Bearer kb_live_xxx or Bearer kb_test_xxx' },
        { status: 401 }
      ),
    };
  }

  const hash = hashKey(raw);
  const supabase = createAdminClient();

  const { data: key, error } = await (supabase as any)
    .from('api_keys')
    .select('id, shop_id, type, is_active')
    .eq('key_hash', hash)
    .single();

  if (error || !key) {
    return { error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }) };
  }

  if (!(key as any).is_active) {
    return { error: NextResponse.json({ error: 'API key is disabled' }, { status: 403 }) };
  }

  // Update last_used_at (fire-and-forget)
  ;(supabase as any)
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', (key as any).id)
    .then(() => {});

  return {
    ctx: {
      shopId: (key as any).shop_id,
      keyId: (key as any).id,
      keyType: (key as any).type as 'test' | 'live',
    },
  };
}

/** Log an API request. Fire-and-forget — never throws. */
export async function logApiRequest(
  ctx: ApiContext,
  req: NextRequest,
  statusCode: number,
  durationMs: number
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const url = new URL(req.url);
    await (supabase as any).from('api_usage_logs').insert({
      api_key_id: ctx.keyId,
      shop_id: ctx.shopId,
      endpoint: url.pathname,
      method: req.method,
      status_code: statusCode,
      ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
      duration_ms: durationMs,
    });
  } catch {
    // logging failure must never affect the response
  }
}

export function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Generate a new API key pair. Returns { rawKey, hash, prefix }. */
export function generateApiKey(type: 'test' | 'live'): { raw: string; hash: string; prefix: string } {
  const rand = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}-${process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'secret'}`)
    .digest('hex');
  const raw = `kb_${type}_${rand}`;
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 20); // "kb_live_" + 12 chars
  return { raw, hash, prefix };
}

/** Standard API error helper */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Validate that body only contains allowed fields (prevents mass-assignment). */
export function pick<T extends object>(obj: unknown, keys: (keyof T)[]): Partial<T> {
  if (!obj || typeof obj !== 'object') return {};
  return keys.reduce((acc, k) => {
    if (k in (obj as object)) (acc as any)[k] = (obj as any)[k];
    return acc;
  }, {} as Partial<T>);
}
