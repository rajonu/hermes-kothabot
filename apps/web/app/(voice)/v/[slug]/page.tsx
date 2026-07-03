import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getInAppBrowserProtection } from '@/lib/platform-settings';
import { WidgetPage } from '@/app/(widget)/widget/[shopId]/WidgetPage';
import { InAppBrowserGuard } from '@/components/voice/InAppBrowserGuard';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getShopBySlug(slug: string) {
  const db = createAdminClient();
  const { data: shop } = await (db as any)
    .from('shops')
    .select('*')
    .eq('public_slug', slug)
    .single();
  if (!shop || !shop.public_access_enabled) return null;
  return shop as any;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) return { title: 'Not Found' };
  const title = shop.public_page_title || shop.name;
  const description = shop.public_page_description || 'Talk to our AI assistant';
  const avatar = shop.ai_config?.avatar ?? null;
  return {
    title,
    description,
    openGraph: { title, description, ...(avatar ? { images: [{ url: avatar }] } : {}) },
    twitter: { card: 'summary', title, description, ...(avatar ? { images: [avatar] } : {}) },
  };
}

export default async function VoiceSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const [shop, inappProtectionEnabled] = await Promise.all([
    getShopBySlug(slug),
    getInAppBrowserProtection(),
  ]);
  if (!shop) notFound();

  // Fetch training data + products + subscription in parallel
  const db = createAdminClient();
  const [{ data: trainingRows }, { data: productRows }, { data: subData }] = await Promise.all([
    (db as any).from('training_data').select('extracted_text').eq('shop_id', shop.id).order('created_at'),
    (db as any).from('products').select('name,description,price,category,is_available,unit,metadata').eq('shop_id', shop.id).eq('is_available', true).order('name'),
    (db as any).from('subscriptions').select('status').eq('shop_id', shop.id).maybeSingle(),
  ]);
  const isLocked = subData?.status === 'past_due';

  const contextParts: string[] = [];
  if (trainingRows?.length) contextParts.push(trainingRows.map((r: any) => r.extracted_text).join('\n\n'));
  if (productRows?.length) {
    const lines = productRows.map((p: any) => {
      const parts = [`- ${p.name}`];
      if (p.category) parts.push(`(${p.category})`);
      if (p.price) parts.push(`৳${p.price}`);
      if (p.description) parts.push(`— ${p.description}`);
      return parts.join(' ');
    }).join('\n');
    contextParts.push(`## Services & Products\n${lines}`);
  }
  const trainingData = contextParts.length ? contextParts.join('\n\n') : undefined;

  const isIntlShop = (shop.ai_config?.billing_region ?? 'BD') === 'INTL';
  const effectiveLang = (shop.ai_config?.language === 'auto' && isIntlShop)
    ? 'en' : (shop.ai_config?.language ?? (isIntlShop ? 'en' : 'auto'));
  const effectiveGreeting = shop.widget_config?.greeting ?? (isIntlShop
    ? `Hello! I am an intelligent assistant of ${shop.name}. How may I help you today?`
    : "হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?");

  return (
    <InAppBrowserGuard slug={slug} enabled={inappProtectionEnabled}>
      <WidgetPage
        shopId={shop.id}
        shopName={shop.name}
        systemPrompt={shop.ai_config?.systemPrompt}
        greetingMessage={effectiveGreeting}
        themeColor={shop.widget_config?.primaryColor ?? '#10b981'}
        language={effectiveLang}
        voice={shop.ai_config?.voice ?? 'Aoede'}
        aiModel={shop.ai_config?.ai_model}
        trainingData={trainingData}
        collectFields={shop.ai_config?.collect_fields ?? { name: true, phone: true, address: true }}
        category={shop.category}
        isLocked={isLocked}
      />
    </InAppBrowserGuard>
  );
}
