import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import { LiveChatClient } from './LiveChatClient';

export default async function LiveChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: shopRaw, error } = await (supabase as any)
    .from('shops').select('id, name').eq('owner_id', user.id).single();

  if (error) console.error('[livechat] shop query error:', error);
  if (!shopRaw) return <p className="p-6 text-gray-400">Could not load shop.</p>;
  const shop = shopRaw as any;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] sm:h-[calc(100vh-6rem)]">
      <PageHeader
        title="Live Chat"
        description="Reply to customers on Facebook Messenger and WhatsApp in real time."
      />
      <div className="flex-1 min-h-0">
        <LiveChatClient shopId={shop.id} />
      </div>
    </div>
  );
}
