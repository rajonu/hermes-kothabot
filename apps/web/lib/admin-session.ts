import { createAdminClient } from './supabase/server';
import { cookies, headers } from 'next/headers';
import { NextRequest } from 'next/server';

const COOKIE_NAME   = 'kothabot_admin_session';
const SESSION_MINS  = Number(process.env.ADMIN_SESSION_MINUTES ?? 43200); // 30 days, matches verify-pin default
const SECRET        = process.env.ADMIN_SESSION_SECRET ?? 'change-me';
const ADMIN_PIN     = process.env.ADMIN_PIN ?? '';

// ── Simple HMAC-based session token (no external deps) ──────────────────────
// Format: base64(payload) . base64(hmac)
async function hmac(data: string): Promise<string> {
  const enc   = new TextEncoder();
  const key   = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig   = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Buffer.from(sig).toString('base64url');
}

interface SessionPayload {
  exp: number;   // unix ms
  iat: number;
}

export async function createAdminSessionToken(): Promise<string> {
  const payload: SessionPayload = {
    iat: Date.now(),
    exp: Date.now() + SESSION_MINS * 60 * 1000,
  };
  const b64     = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = await hmac(b64);
  return `${b64}.${sig}`;
}

export async function verifyAdminSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;

    const expectedSig = await hmac(b64);
    if (sig !== expectedSig) return null;   // tampered

    const payload: SessionPayload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (Date.now() > payload.exp) return null; // expired

    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export function verifyAdminPin(pin: string): boolean {
  if (!ADMIN_PIN) return false;
  // Constant-time comparison to prevent timing attacks
  if (pin.length !== ADMIN_PIN.length) return false;
  let diff = 0;
  for (let i = 0; i < pin.length; i++) {
    diff |= pin.charCodeAt(i) ^ ADMIN_PIN.charCodeAt(i);
  }
  return diff === 0;
}

export function getSessionRemainingMinutes(session: SessionPayload): number {
  return Math.max(0, Math.floor((session.exp - Date.now()) / 60000));
}

// ── Rate limiting (in-memory, resets on server restart) ───────────────────
const pinAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS     = 5;
const LOCKOUT_MINS     = 15;

export function checkPinRateLimit(ip: string): { allowed: boolean; remainingMins?: number } {
  const now    = Date.now();
  const record = pinAttempts.get(ip);

  if (record && now < record.resetAt) {
    if (record.count >= MAX_ATTEMPTS) {
      return { allowed: false, remainingMins: Math.ceil((record.resetAt - now) / 60000) };
    }
  }
  return { allowed: true };
}

export function recordFailedPinAttempt(ip: string): number {
  const now    = Date.now();
  const record = pinAttempts.get(ip) ?? { count: 0, resetAt: now + LOCKOUT_MINS * 60 * 1000 };

  if (now > record.resetAt) {
    record.count  = 1;
    record.resetAt = now + LOCKOUT_MINS * 60 * 1000;
  } else {
    record.count++;
  }

  pinAttempts.set(ip, record);
  return record.count;
}

export function clearPinAttempts(ip: string) {
  pinAttempts.delete(ip);
}

// ── Audit logging ─────────────────────────────────────────────────────────
export async function auditLog({
  action, targetType, targetId, details, req,
}: {
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  req?: NextRequest;
}) {
  try {
    const db = createAdminClient();
    const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? req?.headers.get('x-real-ip')
             ?? 'unknown';
    const ua = req?.headers.get('user-agent') ?? 'unknown';

    await (db as any).from('admin_audit_log').insert({
      admin_email: 'god_admin',
      action,
      target_type: targetType,
      target_id:   targetId,
      details:     details ?? null,
      ip_address:  ip,
      user_agent:  ua,
    });
  } catch (e) {
    console.warn('[audit] log failed:', e);
  }
}

// ── Single helper for all admin API routes ────────────────────────────────
// Returns 401 NextResponse if PIN session is missing; otherwise returns null.
export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    const { NextResponse } = await import('next/server');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
