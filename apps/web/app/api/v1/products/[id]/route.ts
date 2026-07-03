import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

const PRODUCT_COLUMNS = 'id, name, description, price, category, sku, stock_qty, unit, metadata, is_available, created_at';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ data });
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const allowed = ['name', 'description', 'price', 'category', 'sku', 'stock_qty', 'unit', 'is_available', 'metadata'];
    const updates: Record<string, any> = {};
    for (const k of allowed) {
      if (k in body) updates[k] = body[k];
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('shop_id', ctx.shopId)
      .select(PRODUCT_COLUMNS)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ data });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (ctx) => {
    const { id } = await params;
    const supabase = createAdminClient();
    const { error } = await (supabase as any)
      .from('products')
      .delete()
      .eq('id', id)
      .eq('shop_id', ctx.shopId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
