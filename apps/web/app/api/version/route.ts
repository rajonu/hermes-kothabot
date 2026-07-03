import { NextResponse } from 'next/server';
import { BUILD_NUMBER } from '@/lib/version';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ build: BUILD_NUMBER });
}
