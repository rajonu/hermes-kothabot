export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/server';
import { KnowledgeManagerClient } from './KnowledgeManagerClient';

export default async function KnowledgeManagerPage() {
  // Auth handled by (admin)/layout.tsx
  const db = createAdminClient() as any;

  const { data: shops } = await db
    .from('shops')
    .select('id, name, category')
    .order('name')
    .limit(100);

  const shopIds = (shops ?? []).map((s: any) => s.id);

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

  const shopsWithKnowledge = (shops ?? []).map((s: any) => ({
    ...s,
    knowledge_source: sourceMap[s.id] ?? null,
    knowledge_chunks: chunkMap[s.id] ?? [],
  }));

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Knowledge Manager</h1>
          <p className="text-sm text-gray-400 mt-0.5">View, re-run, and manage AI knowledge extraction for all shops.</p>
        </div>

        <KnowledgeManagerClient shops={shopsWithKnowledge} />
      </div>
    </div>
  );
}
