import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import { Brain } from 'lucide-react';
import { TrainingManager } from './TrainingManager';
import { KnowledgeExtractor } from './KnowledgeExtractor';
import { ExtractionHelper } from './ExtractionHelper';

export default async function TrainingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw } = await (supabase as any).from('shops').select('id, name, ai_config').eq('owner_id', user.id).single();
  if (!shopRaw) return null;

  const [{ data: entries }, { data: knowledgeSource }, { data: knowledgeChunks }] = await Promise.all([
    (supabase as any)
      .from('training_data')
      .select('id, source_type, extracted_text, source_url, created_at')
      .eq('shop_id', shopRaw.id)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('knowledge_sources')
      .select('id, website_url, facebook_url, website_status, facebook_status, extraction_status, extracted_at')
      .eq('shop_id', shopRaw.id)
      .single(),
    (supabase as any)
      .from('knowledge_chunks')
      .select('id, source_type, content, word_count, created_at')
      .eq('shop_id', shopRaw.id),
  ]);

  return (
    <div>
      <PageHeader
        title="AI Knowledge Base"
        description="Teach your voice assistant about your business — products, FAQs, policies, and more."
        docsUrl="https://kothabot.ai.bd/docs/business-info"
      />

      {/* Info banner */}
      <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 mb-5 flex items-start gap-3">
        <Brain size={16} className="text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-white">How training data works</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Everything you add here is included in your AI assistant's context. Add FAQs, business info, or let the AI automatically extract knowledge from your website and Facebook page.
          </p>
        </div>
      </div>

      {/* Smart Knowledge Extraction */}
      <div className="mb-6">
        <KnowledgeExtractor
          shopId={shopRaw.id}
          initialSource={knowledgeSource ?? null}
          initialChunks={knowledgeChunks ?? []}
        />
      </div>

      {/* Extraction helper */}
      <div className="mb-6">
        <ExtractionHelper />
      </div>

      {/* Manual FAQ / Info entries */}
      <TrainingManager
        shopId={shopRaw.id}
        shopName={shopRaw.name}
        initialEntries={entries ?? []}
      />
    </div>
  );
}
