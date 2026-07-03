import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, logApiRequest, apiError, ApiContext } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/api-rate-limit';

/** Wraps a v1 handler with auth + rate-limit + logging. */
export async function withApiAuth(
  req: NextRequest,
  handler: (ctx: ApiContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const start = Date.now();
  const { ctx, error: authError } = await validateApiKey(req);
  if (authError) return authError;

  const rl = checkRateLimit(ctx.keyId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests/minute.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  let res: NextResponse;
  try {
    res = await handler(ctx);
  } catch (err: any) {
    res = apiError(err?.message ?? 'Internal server error', 500);
  }

  // Add rate-limit headers
  res.headers.set('X-RateLimit-Limit', '60');
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)));
  res.headers.set('X-KothaBot-Version', 'v1');

  // Log asynchronously
  logApiRequest(ctx, req, res.status, Date.now() - start);

  return res;
}
