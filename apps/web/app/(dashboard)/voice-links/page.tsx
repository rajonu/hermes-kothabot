import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import { VoiceLinksManager } from './VoiceLinksManager';
import { getCategoryNav } from '@/lib/category-nav';

export const metadata = {
  title: 'Voice Links',
};

export default async function VoiceLinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: shop, error } = await (supabase as any)
    .from('shops')
    .select('id, name, category, public_slug, public_access_enabled, public_page_title, public_page_description')
    .eq('owner_id', user.id)
    .single();

  if (error || !shop) {
    return (
      <div>
        <PageHeader title="Voice Links" description="Share a public voice link for your business." />
        <p className="px-6 text-gray-400 text-sm">Could not load shop data.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Voice Links"
        description="Give customers a direct link to talk to your AI assistant — no website needed."
        docsUrl="https://kothabot.ai.bd/docs/direct-voice-link"
      />
      <VoiceLinksManager
        shopId={shop.id}
        shopName={shop.name}
        initialSlug={shop.public_slug ?? ''}
        initialEnabled={shop.public_access_enabled ?? true}
        initialTitle={shop.public_page_title ?? ''}
        initialDescription={shop.public_page_description ?? ''}
        customersLabel={getCategoryNav(shop.category).customersLabel}
      />
    </div>
  );
}
