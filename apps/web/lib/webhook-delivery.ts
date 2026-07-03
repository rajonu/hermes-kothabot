import { createHmac } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

export type WebhookEvent =
  | 'appointment.created' | 'appointment.updated'
  | 'order.created'       | 'order.updated'
  | 'customer.created'    | 'customer.updated'
  | 'support.created'     | 'support.updated';

/** Deliver a webhook event to all registered endpoints for a shop. Fire-and-forget. */
export async function dispatchWebhook(
  shopId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: endpoints } = await (supabase as any)
      .from('webhook_endpoints')
      .select('id, url, secret, events')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (!endpoints?.length) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.allSettled(
      (endpoints as any[])
        .filter((ep) => ep.events.includes(event) || ep.events.includes('*'))
        .map((ep) => deliverOne(ep, event, body, payload, supabase))
    );
  } catch {
    // webhook delivery must never crash the main flow
  }
}

async function deliverOne(
  ep: { id: string; url: string; secret: string },
  event: string,
  body: string,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createAdminClient>
) {
  const sig = createHmac('sha256', ep.secret).update(body).digest('hex');
  const start = Date.now();
  let responseStatus: number | null = null;
  let responseBody = '';
  let success = false;

  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KothaBot-Event': event,
        'X-KothaBot-Signature': `sha256=${sig}`,
        'X-KothaBot-Timestamp': new Date().toISOString(),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 500);
    success = res.ok;
  } catch (err: any) {
    responseBody = err?.message ?? 'fetch failed';
  }

  await (supabase as any).from('webhook_deliveries').insert({
    webhook_id: ep.id,
    shop_id: payload.shop_id ?? null,
    event,
    payload,
    response_status: responseStatus,
    response_body: responseBody,
    duration_ms: Date.now() - start,
    success,
    attempt: 1,
  });
}
