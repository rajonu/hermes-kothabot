import { NextRequest, NextResponse } from 'next/server';
import { auditLog } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  await auditLog({ action: 'admin_logout', req });
  const res = NextResponse.json({ success: true });
  res.cookies.delete('kothabot_admin_session');
  return res;
}
