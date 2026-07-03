import { NextRequest, NextResponse } from 'next/server';
import { getCategoryPrompts } from '@/lib/platform-settings';
import { DEFAULT_CATEGORY_PROMPTS } from '@/lib/prompt-layers';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? 'other';

  const stored = await getCategoryPrompts();
  const rules = stored[category] ?? DEFAULT_CATEGORY_PROMPTS[category] ?? DEFAULT_CATEGORY_PROMPTS['other'];

  return NextResponse.json({ category, rules }, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
