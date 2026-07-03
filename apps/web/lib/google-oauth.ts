/**
 * Shared Google OAuth plumbing for Calendar and Sheets integrations.
 * Handles token exchange, refresh, revoke, and user profile fetching.
 */

export const GOOGLE_AUTH_URL    = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL  = 'https://oauth2.googleapis.com/revoke';

export const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID;
export const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
export const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://my.kothabot.ai.bd';

export interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  token_type:    string;
  scope:         string;
}

export function getGoogleAuthUrl(state: string, scopes: string[], redirectUri: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         scopes.join(' '),
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`);
}

export async function getGoogleProfile(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to get Google profile');
  return res.json();
}
