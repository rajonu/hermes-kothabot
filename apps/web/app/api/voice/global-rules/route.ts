import { NextResponse } from 'next/server';
import { getGlobalAIRules } from '@/lib/platform-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rules = await getGlobalAIRules();
  return NextResponse.json({ rules });
}
