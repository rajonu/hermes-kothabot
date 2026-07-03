/**
 * Facebook Messenger integration — Meta Login for Business + Graph API.
 * Pure fetch, mirrors the style of lib/google-calendar.ts.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const FB_OAUTH_URL = 'https://www.facebook.com/' + GRAPH_VERSION + '/dialog/oauth';

const APP_ID = process.env.META_APP_ID ?? '';
const APP_SECRET = process.env.META_APP_SECRET ?? '';
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd'}/api/integrations/facebook/callback`;

// Facebook Login for Business requires a Configuration ID instead of a raw
// `scope` param — the permissions (pages_messaging, pages_show_list,
// pages_manage_metadata) are bound to this configuration in the Meta dashboard.
const LOGIN_CONFIG_ID = process.env.META_LOGIN_CONFIG_ID ?? '';

export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    config_id: LOGIN_CONFIG_ID,
    state,
  });
  return `${FB_OAUTH_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<{ access_token: string }> {
  const params = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error(`Code exchange failed: ${await res.text()}`);
  return res.json();
}

export async function getLongLivedToken(shortLivedToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function getPages(userToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const params = new URLSearchParams({ access_token: userToken });
  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params}`);
  if (!res.ok) throw new Error(`Failed to list pages: ${await res.text()}`);
  const data = await res.json();
  return data.data ?? [];
}

export async function subscribeApp(pageId: string, pageToken: string): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: 'messages,messaging_postbacks',
    access_token: pageToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${pageId}/subscribed_apps?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`subscribed_apps failed: ${await res.text()}`);
}

export async function sendMessage(
  pageId: string,
  pageToken: string,
  psid: string,
  text: string
): Promise<{ message_id: string }> {
  const res = await fetch(`${GRAPH_BASE}/${pageId}/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text },
    }),
  });
  if (!res.ok) throw new Error(`Send message failed: ${await res.text()}`);
  return res.json();
}
