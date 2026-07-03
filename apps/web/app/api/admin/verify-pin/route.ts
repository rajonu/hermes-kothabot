import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminPin,
  createAdminSessionToken,
  checkPinRateLimit,
  recordFailedPinAttempt,
  clearPinAttempts,
} from '@/lib/admin-session';

const SESSION_MINS = Number(process.env.ADMIN_SESSION_MINUTES ?? 43200); // 30 days default
const COOKIE_NAME  = 'kothabot_admin_session';

export async function POST(req: NextRequest) {
  // No Supabase login required — PIN is the only credential
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip')
           ?? 'unknown';

  const rateCheck = checkPinRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many attempts', remainingMins: rateCheck.remainingMins }, { status: 429 });
  }

  const { pin } = await req.json();

  if (!verifyAdminPin(pin)) {
    const attempts = recordFailedPinAttempt(ip);
    return NextResponse.json({
      error: `Incorrect PIN (${attempts} failed attempt${attempts > 1 ? 's' : ''})`
    }, { status: 401 });
  }

  // ✅ PIN correct — create 30-day session token (no email tied to it)
  clearPinAttempts(ip);
  const token = await createAdminSessionToken();

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   SESSION_MINS * 60,
  });
  return res;
}
