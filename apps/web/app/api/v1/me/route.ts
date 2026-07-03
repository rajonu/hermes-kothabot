import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const supabase = createAdminClient();
    const { data: shop, error } = await (supabase as any)
      .from('shops')
      .select('id, name, category, ai_config')
      .eq('id', ctx.shopId)
      .single();

    if (error || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        category: shop.category,
        language: shop.ai_config?.language ?? 'auto',
      },
      key_type: ctx.keyType,
    });
  });
}
