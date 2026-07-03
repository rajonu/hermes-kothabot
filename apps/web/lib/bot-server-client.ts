/**
 * Thin client for the WhatsApp bot-server's outbound send endpoint.
 * Contract shared with apps/bot-server: POST /internal/wa-send,
 * header x-internal-secret === BOT_INTERNAL_SECRET,
 * body {shopId, jid, text} -> {ok: true, externalMessageId}.
 */
export async function sendWhatsAppMessage(
  shopId: string,
  jid: string,
  text: string
): Promise<{ externalMessageId: string }> {
  const baseUrl = process.env.BOT_SERVER_URL;
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!baseUrl || !secret) throw new Error('BOT_SERVER_URL or BOT_INTERNAL_SECRET not configured');

  const res = await fetch(`${baseUrl}/internal/wa-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ shopId, jid, text }),
  });
  if (!res.ok) throw new Error(`wa-send failed: ${await res.text()}`);

  const data = await res.json();
  if (!data?.ok) throw new Error('wa-send returned ok:false');
  return { externalMessageId: data.externalMessageId };
}
