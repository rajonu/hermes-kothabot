import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '../_lib/respond';
import { createAdminClient } from '@/lib/supabase/server';

const PRODUCT_COLUMNS = 'id, name, description, price, category, sku, stock_qty, unit, metadata, is_available, created_at';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
    const available = searchParams.get('available');

    const supabase = createAdminClient();
    let q = (supabase as any)
      .from('products')
      .select(PRODUCT_COLUMNS, { count: 'exact' })
      .eq('shop_id', ctx.shopId)
      .order('name', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (available === 'true') q = q.eq('is_available', true);
    if (available === 'false') q = q.eq('is_available', false);

    const { data, error, count } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data,
      meta: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// ── Map an inbound product payload to the products table columns ──────────────
function mapProduct(shopId: string, body: any) {
  return {
    shop_id: shopId,
    name: String(body.name ?? '').trim(),
    description: body.description ?? null,
    price: body.price ?? null,
    category: body.category ?? null,
    sku: body.sku ?? null,
    stock_qty: body.stock_qty ?? null,
    unit: body.unit ?? null,
    is_available: body.is_available ?? true,
    metadata: body.metadata ?? {},
  };
}

// ── Upsert a single product by (shop_id, sku) ─────────────────────────────────
// Done manually rather than via ON CONFLICT so products WITHOUT a sku still
// insert cleanly (null skus are not treated as conflicts).
async function upsertOne(supabase: any, shopId: string, body: any) {
  const row = mapProduct(shopId, body);
  if (!row.name) return { error: 'Product name is required' };

  if (row.sku) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('shop_id', shopId)
      .eq('sku', row.sku)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('products')
        .update(row)
        .eq('id', existing.id)
        .select(PRODUCT_COLUMNS)
        .single();
      return { data, error: error?.message, action: 'updated' };
    }
  }

  const { data, error } = await supabase
    .from('products')
    .insert(row)
    .select(PRODUCT_COLUMNS)
    .single();
  return { data, error: error?.message, action: 'created' };
}

// ── POST /api/v1/products ─────────────────────────────────────────────────────
// Single: { name, sku, price, ... }  → upsert by sku
// Bulk:   { products: [ {...}, {...} ] } → upsert each (max 100 per request)
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });

    const supabase = createAdminClient();

    // Bulk form
    if (Array.isArray(body.products)) {
      if (body.products.length > 100) {
        return NextResponse.json({ error: 'Max 100 products per request' }, { status: 422 });
      }
      const results = [];
      for (const item of body.products) {
        results.push(await upsertOne(supabase, ctx.shopId, item));
      }
      const errors = results.filter((r) => r.error);
      return NextResponse.json(
        {
          synced: results.filter((r) => !r.error).length,
          failed: errors.length,
          errors: errors.map((e) => e.error),
        },
        { status: errors.length && !results.some((r) => !r.error) ? 422 : 200 }
      );
    }

    // Single form
    const result = await upsertOne(supabase, ctx.shopId, body);
    if (result.error) {
      const status = result.error === 'Product name is required' ? 422 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ data: result.data, action: result.action }, { status: 201 });
  });
}
