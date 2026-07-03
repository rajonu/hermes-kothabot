import type { PushPayload } from '@/app/api/push/send/route';

// Call from server-side code (route handlers, server actions) to send a push notification.
// Silently no-ops if INTERNAL_API_SECRET or NEXT_PUBLIC_APP_URL is missing.
export async function sendPushNotification(payload: PushPayload): Promise<void> {
  const secret  = process.env.INTERNAL_API_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!secret || !baseUrl) return;

  try {
    await fetch(`${baseUrl}/api/push/send`, {
      method:  'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body:    JSON.stringify(payload),
    });
  } catch {}
}
