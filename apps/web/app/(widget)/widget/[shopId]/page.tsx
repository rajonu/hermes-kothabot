import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { buildTrainingData } from '@/lib/widget-training';
import { WidgetPage } from './WidgetPage';

interface Props {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<{ color?: string; lang?: string; voice?: string; mode?: string; autostart?: string }>;
}

export default async function VoiceWidgetPage({ params, searchParams }: Props) {
  const { shopId } = await params;
  const { color, lang, voice, mode, autostart } = await searchParams;

  // Geo: prefer Cloudflare, fall back to Vercel, default to BD
  const h = await headers();
  const country = (h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || 'BD').toUpperCase();

  // Admin client bypasses RLS — widget is public, no user session available
  const supabase = createAdminClient();
  const { data: shopRaw, error } = await (supabase as any)
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();

  if (error) console.error('[widget] shop fetch error:', JSON.stringify(error));

  if (!shopRaw) notFound();
  const shop = shopRaw as any;

  // Build the AI knowledge base (knowledge chunks incl. WordPress + training
  // data + products) via the shared assembler; fetch subscription in parallel.
  const [trainingData, { data: subData }] = await Promise.all([
    buildTrainingData(supabase, shopId, shop.name, shop.category),
    (supabase as any).from('subscriptions').select('status').eq('shop_id', shopId).maybeSingle(),
  ]);

  const isLocked = subData?.status === 'past_due';

  const isIntlShop = (shop.ai_config?.billing_region ?? 'BD') === 'INTL';
  const effectiveLang = lang ?? (
    shop.ai_config?.language === 'auto' && isIntlShop ? 'en' : (shop.ai_config?.language ?? (isIntlShop ? 'en' : 'auto'))
  );
  const defaultGreeting = isIntlShop
    ? `Hello! I am an intelligent assistant of ${shop.name}. How may I help you today?`
    : "হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?";

  return (
    <WidgetPage
      shopId={shop.id}
      shopName={shop.name}
      systemPrompt={shop.ai_config?.systemPrompt}
      greetingMessage={shop.widget_config?.greeting ?? defaultGreeting}
      themeColor={color ?? shop.widget_config?.primaryColor ?? '#10b981'}
      language={effectiveLang}
      voice={voice ?? shop.ai_config?.voice ?? 'Aoede'}
      aiModel={shop.ai_config?.ai_model}
      trainingData={trainingData}
      collectFields={shop.ai_config?.collect_fields ?? { name: true, phone: true, address: true }}
      category={shop.category}
      defaultMode={(mode === 'chat' ? 'chat' : 'voice') as 'voice' | 'chat'}
      voiceEnabled={true}
      chatEnabled={true}
      isLocked={isLocked}
      country={country}
      requirePhone={shop.widget_config?.requirePhone === true}
      autostart={autostart === '1'}
      whiteLabel={!!shop.ai_config?.white_label}
    />
  );
}
