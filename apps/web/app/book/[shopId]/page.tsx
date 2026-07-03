import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { BookingWizard } from './BookingWizard';

export const dynamic = 'force-dynamic';

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { shopId } = await params;
  const sp = await searchParams;
  const db = createAdminClient();

  const { data: shop } = await (db as any)
    .from('shops')
    .select('id, name, category, widget_config')
    .eq('id', shopId)
    .single();

  if (!shop || shop.category !== 'clinic') notFound();

  // URL params override shop defaults — set by the embed code generator
  const primaryColor = sp.color ? decodeURIComponent(sp.color) : (shop.widget_config?.primaryColor ?? '#10b981');
  const theme = (sp.theme === 'light' ? 'light' : 'dark') as 'dark' | 'light';

  const isDark = theme === 'dark';

  return (
    <main className={`min-h-screen flex items-start justify-center p-4 pt-8 ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="w-full max-w-2xl">
<BookingWizard shopId={shopId} shopName={shop.name} primaryColor={primaryColor} theme={theme} />
      </div>
    </main>
  );
}
