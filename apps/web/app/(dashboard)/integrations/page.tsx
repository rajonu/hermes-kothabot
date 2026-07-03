import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/PageHeader';
import { getDocsCategory } from '@/lib/category-nav';
import { EmbedConfigurator } from './EmbedConfigurator';
import { ApiAccessPanel } from './ApiAccessPanel';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';
import { TelephonyPanel } from './TelephonyPanel';
import { LeadCaptureToggle } from './LeadCaptureToggle';
import { FacebookPanel } from './FacebookPanel';
import { WhatsAppPanel } from './WhatsAppPanel';
import { CollapsibleSection } from './CollapsibleSection';


export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cal?: string; email?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: shopRaw, error } = await (supabase as any)
    .from('shops').select('*').eq('owner_id', user.id).single();

  if (error) console.error('[integrations] shop query error:', error);
  if (!shopRaw) return <p className="p-6 text-gray-400">Could not load shop.</p>;
  const shop = shopRaw as any;
  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'localhost:3001';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

  const isBookingOrAppointment = shop.category === 'clinic' || shop.category === 'salon' || shop.category === 'services';

  const quickNav = [
    isBookingOrAppointment && { id: 'google-calendar', label: 'Google Calendar' },
    shop.ai_config?.voip_enabled && { id: 'sip-telephony', label: 'SIP Telephony' },
    shop.ai_config?.api_access_enabled && { id: 'api-access', label: 'API Access' },
    { id: 'facebook-messenger', label: 'Messenger' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'lead-capture', label: 'Lead Capture' },
    { id: 'website-widget', label: 'Website Widget' },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect KothaBot to your favourite tools and channels."
        docsUrl={`https://kothabot.ai.bd/docs/integrations?category=${getDocsCategory(shop.category)}`}
      />

      {/* Quick nav submenu */}
      <div className="flex flex-wrap gap-2 mb-6">
        {quickNav.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800/60 text-gray-300 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* Google Calendar OAuth feedback banner */}
      {isBookingOrAppointment && sp.cal === 'connected' && (
        <div className="mb-6 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3 text-sm text-emerald-300">
          ✅ Google Calendar connected successfully! Signed in as <strong>{sp.email}</strong>. Appointments will now sync automatically.
        </div>
      )}
      {isBookingOrAppointment && sp.cal === 'error' && (
        <div className="mb-6 bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300">
          ❌ Could not connect Google Calendar — {sp.reason?.replace(/_/g, ' ') ?? 'unknown error'}. Please try again.
        </div>
      )}

      {/* Google Calendar */}
      {isBookingOrAppointment && (
        <CollapsibleSection
          id="google-calendar"
          title="Google Calendar"
          badge="AUTO-SYNC"
          badgeColor="bg-green-700"
          dotColor="bg-green-400"
          description="Automatically create calendar events for every appointment, booking, and reservation."
        >
          <GoogleCalendarPanel />
        </CollapsibleSection>
      )}

      {/* Telephony (SIP Trunk) — gated by god admin */}
      {shop.ai_config?.voip_enabled && (
        <CollapsibleSection
          id="sip-telephony"
          title="SIP Telephony Trunk"
          badge="VOICE ASSISTANT"
          badgeColor="bg-indigo-700"
          dotColor="bg-indigo-400"
          description="Connect your telephone line so customers can call and talk directly to your voice assistant."
        >
          <TelephonyPanel
            shopId={shop.id}
            initialTelephony={shop.ai_config?.telephony ?? null}
          />
        </CollapsibleSection>
      )}

      {/* API Access — gated by god admin */}
      {shop.ai_config?.api_access_enabled && (
        <CollapsibleSection
          id="api-access"
          title="API Access"
          badge="DEVELOPER"
          badgeColor="bg-blue-700"
          dotColor="bg-blue-400"
          description="Connect WhatsApp, Messenger, Telegram, Zapier, Make.com, CRMs, and custom apps to KothaBot."
        >
          <ApiAccessPanel />
        </CollapsibleSection>
      )}

      {/* Facebook Messenger */}
      <CollapsibleSection
        id="facebook-messenger"
        title="Facebook Messenger"
        dotColor="bg-blue-400"
        description="Let customers chat with your AI assistant directly on your Facebook Page."
        defaultOpen
      >
        <FacebookPanel />
      </CollapsibleSection>

      {/* WhatsApp */}
      <CollapsibleSection
        id="whatsapp"
        title="WhatsApp"
        dotColor="bg-green-400"
        description="Link your WhatsApp number so customers can message your AI assistant there."
        defaultOpen
      >
        <WhatsAppPanel shopId={shop.id} />
      </CollapsibleSection>

      {/* Lead Capture toggle */}
      <CollapsibleSection
        id="lead-capture"
        title="Lead Capture"
      >
        <LeadCaptureToggle initialRequirePhone={shop.widget_config?.requirePhone === true} />
      </CollapsibleSection>

      {/* Website Widget Embed */}
      <CollapsibleSection
        id="website-widget"
        title="Website Widget"
        badge="ACTIVE"
        badgeColor="bg-emerald-600"
      >
        <EmbedConfigurator
          shopId={shop.id}
          shopName={shop.name}
          themeColor={shop.widget_config?.primaryColor ?? '#10b981'}
          language={shop.ai_config?.language ?? 'auto'}
          appUrl={appUrl}
          avatar={shop.ai_config?.avatar ?? null}
          systemPrompt={shop.ai_config?.systemPrompt}
          greetingMessage={shop.widget_config?.greeting}
          enableVoice={shop.widget_config?.enableVoice !== false}
          enableChat={shop.widget_config?.enableChat !== false}
          category={shop.category}
          publicSlug={shop.public_slug ?? null}
        />
      </CollapsibleSection>

    </div>
  );
}
