import { NextRequest, NextResponse } from 'next/server';
import { getCategoryPrompts, updatePlatformSetting } from '@/lib/platform-settings';
import { requireAdminSession } from '@/lib/admin-session';
import { DEFAULT_CATEGORY_PROMPTS, ALL_CATEGORIES } from '@/lib/prompt-layers';

export async function GET() {
  const stored = await getCategoryPrompts();
  // Merge stored over defaults so admin always sees a value
  const prompts: Record<string, string> = {};
  for (const cat of ALL_CATEGORIES) {
    prompts[cat] = stored[cat] ?? DEFAULT_CATEGORY_PROMPTS[cat] ?? '';
  }
  return NextResponse.json({ prompts });
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { prompts } = await req.json();
  if (!prompts || typeof prompts !== 'object') {
    return NextResponse.json({ error: 'prompts must be an object' }, { status: 400 });
  }

  // Only save recognised categories
  const clean: Record<string, string> = {};
  for (const cat of ALL_CATEGORIES) {
    if (typeof prompts[cat] === 'string') clean[cat] = prompts[cat];
  }

  await updatePlatformSetting('category_prompts', clean);
  return NextResponse.json({ ok: true });
}
