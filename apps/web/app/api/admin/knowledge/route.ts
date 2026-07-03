import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/admin-session';

// GET — list all shops with their knowledge extraction status
export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const db = createAdminClient() as any;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';

  const { data: shops } = await db
    .from('shops')
    .select('id, name, category, owner_id')
    .ilike('name', `%${search}%`)
    .order('name')
    .limit(50);

  if (!shops?.length) return NextResponse.json({ shops: [] });

  const shopIds = shops.map((s: any) => s.id);

  const [{ data: sources }, { data: chunks }] = await Promise.all([
    db.from('knowledge_sources').select('*').in('shop_id', shopIds),
    db.from('knowledge_chunks').select('shop_id, source_type, word_count, created_at').in('shop_id', shopIds),
  ]);

  const sourceMap = Object.fromEntries((sources ?? []).map((s: any) => [s.shop_id, s]));
  const chunkMap: Record<string, any[]> = {};
  for (const c of (chunks ?? [])) {
    if (!chunkMap[c.shop_id]) chunkMap[c.shop_id] = [];
    chunkMap[c.shop_id].push(c);
  }

  const result = shops.map((s: any) => ({
    ...s,
    knowledge_source: sourceMap[s.id] ?? null,
    knowledge_chunks: chunkMap[s.id] ?? [],
  }));

  return NextResponse.json({ shops: result });
}

// DELETE — delete all knowledge for a shop (full reset)
export async function DELETE(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId } = await req.json();
  if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

  const db = createAdminClient() as any;
  await Promise.all([
    db.from('knowledge_chunks').delete().eq('shop_id', shopId),
    db.from('knowledge_sources').delete().eq('shop_id', shopId),
  ]);

  return NextResponse.json({ success: true });
}

// PATCH — reset a specific source type status (lets client re-run without re-extracting all)
export async function PATCH(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { shopId, sourceType } = await req.json(); // sourceType: 'website' | 'facebook' | 'all'
  if (!shopId || !sourceType) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = createAdminClient() as any;

  if (sourceType === 'all') {
    await Promise.all([
      db.from('knowledge_chunks').delete().eq('shop_id', shopId),
      db.from('knowledge_sources').update({ website_status: null, facebook_status: null, extraction_status: 'pending', updated_at: new Date().toISOString() }).eq('shop_id', shopId),
    ]);
  } else {
    const field = sourceType === 'website' ? 'website_status' : 'facebook_status';
    await db.from('knowledge_chunks').delete().eq('shop_id', shopId).eq('source_type', sourceType);
    await db.from('knowledge_sources').update({ [field]: null, updated_at: new Date().toISOString() }).eq('shop_id', shopId);
  }

  return NextResponse.json({ success: true });
}
