/**
 * Google Calendar integration — pure fetch, no googleapis package needed.
 * Handles OAuth token exchange, refresh, and Calendar Events CRUD.
 */

const GOOGLE_AUTH_URL    = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL  = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_API_BASE  = 'https://www.googleapis.com/calendar/v3';

const CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '';
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.kothabot.ai.bd'}/api/calendar/callback`;

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'email',
  'profile',
].join(' ');

/* ── OAuth helpers ─────────────────────────────────────────────── */

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         CALENDAR_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  token_type:    string;
  scope:         string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`);
}

export async function getGoogleProfile(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to get Google profile');
  return res.json();
}

/* ── Calendar token management ─────────────────────────────────── */

import { createAdminClient } from '@/lib/supabase/server';

export interface CalendarIntegration {
  id: string;
  shop_id: string;
  google_email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  auto_sync: boolean;
  sync_updates: boolean;
  sync_cancels: boolean;
}

export async function getIntegration(shopId: string): Promise<CalendarIntegration | null> {
  const db = createAdminClient();
  const { data } = await (db as any)
    .from('calendar_integrations')
    .select('*')
    .eq('shop_id', shopId)
    .single();
  return data ?? null;
}

/** Returns a valid access token, refreshing if expired. Updates DB if refreshed. */
export async function getValidToken(integration: CalendarIntegration): Promise<string> {
  const expiry = integration.token_expiry ? new Date(integration.token_expiry).getTime() : 0;
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry

  if (expiry > Date.now() + bufferMs) {
    return integration.access_token;
  }

  const refreshed = await refreshAccessToken(integration.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const db = createAdminClient();
  await (db as any)
    .from('calendar_integrations')
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry })
    .eq('shop_id', integration.shop_id);

  return refreshed.access_token;
}

/* ── Calendar Events CRUD ──────────────────────────────────────── */

export interface CalendarEventPayload {
  summary:     string;
  description: string;
  location?:   string;
  start:       { dateTime: string; timeZone: string };
  end:         { dateTime: string; timeZone: string };
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEventPayload
): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error(`Calendar event create failed: ${await res.text()}`);
  return res.json();
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEventPayload>
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error(`Calendar event update failed: ${await res.text()}`);
}

export async function cancelCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await updateCalendarEvent(accessToken, calendarId, eventId, {
    summary: `[Cancelled] ${await getEventTitle(accessToken, calendarId, eventId)}`,
  });
}

async function getEventTitle(accessToken: string, calendarId: string, eventId: string): Promise<string> {
  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return data.summary ?? '';
  } catch { return ''; }
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

export async function listCalendars(accessToken: string): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const res = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((c: any) => ({ id: c.id, summary: c.summary, primary: c.primary }));
}
