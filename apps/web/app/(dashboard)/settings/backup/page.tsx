export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BackupManager } from './BackupManager';
import { getDocsCategory } from '@/lib/category-nav';

export default async function BackupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: shop } = await (supabase as any)
    .from('shops')
    .select('id, name, category')
    .eq('owner_id', user.id)
    .single();

  if (!shop) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/settings" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={13} /> Settings
        </Link>
      </div>
      <PageHeader
        title="Backup & Restore"
        description="Protect your business data with automatic and manual backups."
        docsUrl={`https://kothabot.ai.bd/docs/settings-backup?category=${getDocsCategory(shop.category)}`}
      />
      <BackupManager shopId={shop.id} shopName={shop.name} />
    </div>
  );
}
