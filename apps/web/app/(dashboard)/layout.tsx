// Always fetch fresh from server — prevents stale data when switching accounts
export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { VoiceWidget } from "@/components/voice/VoiceWidget";
import { getCategoryNav } from "@/lib/category-nav";
import type { Shop } from "@/lib/supabase/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: shopRaw } = await supabase
    .from("shops")
    .select("id, name, category, ai_config, widget_config, modules")
    .eq("owner_id", user.id)
    .single();
  const shop = shopRaw as unknown as Shop | null;

  if (!shop) redirect("/onboarding");

  const category = (shop as any).category as string ?? 'other';

  // Subscription + all nav/notification counts in a single parallel batch
  // (training data / products / knowledge chunks are NOT loaded here anymore —
  // the VoiceWidget lazy-fetches them from /api/voice/widget-context on open)
  const [
    { data: subData },
    { count: productCount },
    { count: orderCount },
    { count: customerCount },
    { count: pendingOrders },
    { count: unreadSupport },
  ] = await Promise.all([
    (supabase as any).from('subscriptions').select('plan_id, status, current_period_end').eq('shop_id', shop.id).single(),
    // clinic: badge should reflect only diagnostic tests, not doctors/services
    category === 'clinic'
      ? (supabase as any).from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('metadata->>product_type', 'test')
      : (supabase as any).from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    (supabase as any).from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    (supabase as any).from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    (supabase as any).from('orders').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'pending'),
    (supabase as any).from('support_tickets').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('unread_client', true),
  ]);

  const activePlan = subData?.plan_id || 'trial';
  const subStatus = subData?.status || 'trial';
  const isActiveSub = subStatus === 'active';
  const periodEnd = subData?.current_period_end ? new Date(subData.current_period_end) : null;
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : null;

  // Enforce unpaid check: if subscription is past_due and user is trying to access pages other than /billing, redirect
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  if (subStatus === 'past_due' && pathname !== '/billing') {
    redirect('/billing?pay=true');
  }

  const catNav   = getCategoryNav(category);

  const notificationCount = (pendingOrders ?? 0) + (unreadSupport ?? 0);

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar — desktop only (md+) */}
      <Sidebar
        activePlan={activePlan}
        isActiveSub={isActiveSub}
        daysLeft={daysLeft}
        catNav={catNav}
        shopCategory={category}
        productCount={productCount ?? 0}
        orderCount={orderCount ?? 0}
        customerCount={customerCount ?? 0}
        modules={(shop as any).modules ?? null}
      />

      {/* Right column: topbar + scrollable content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar shopName={shop.name} userEmail={user.email} avatar={(shop as any).ai_config?.avatar ?? null} notificationCount={notificationCount} />

        {/* Main content — extra bottom padding on mobile for the tab bar */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom tab bar — mobile only (hidden md+) */}
      <BottomNav
        catNav={catNav}
        productCount={productCount ?? 0}
        orderCount={orderCount ?? 0}
        customerCount={customerCount ?? 0}
        shopName={shop.name}
        userEmail={user.email ?? ''}
        activePlan={activePlan}
        daysLeft={daysLeft}
        isActiveSub={isActiveSub}
        notificationCount={notificationCount}
        modules={(shop as any).modules ?? null}
      />

      {/* Floating voice widget — always available in dashboard */}
      <VoiceWidget
        shopId={shop.id}
        shopName={shop.name}
        systemPrompt={(shop as any).ai_config?.systemPrompt}
        greetingMessage={(shop as any).widget_config?.greeting}
        themeColor={(shop as any).widget_config?.primaryColor ?? '#10b981'}
        language={
          // INTL shops default to English when merchant hasn't set a language explicitly
          ((shop as any).ai_config?.language ?? 'auto') === 'auto' &&
          (shop as any).ai_config?.billing_region === 'INTL'
            ? 'en'
            : ((shop as any).ai_config?.language ?? 'auto')
        }
        aiModel={(shop as any).ai_config?.ai_model}
        lazyContext
        collectFields={(shop as any).ai_config?.collect_fields ?? { name: true, phone: true, address: true }}
        category={category}
        avatar={(shop as any).ai_config?.avatar ?? null}
        enableVoice={(shop as any).widget_config?.enableVoice !== false}
        enableChat={(shop as any).widget_config?.enableChat !== false}
      />
    </div>
  );
}
