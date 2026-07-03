'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid, X, ChevronRight, Bell, LogOut,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { signOut } from '@/modules/auth/actions';
import type { CategoryNav } from '@/lib/category-nav';
import { BUSINESS_NAV, PLATFORM_NAV, isNavItemActive, type NavItem } from '@/lib/nav-items';
import { isModuleEnabled } from '@/lib/modules';

interface BottomNavProps {
  catNav?:        CategoryNav;
  productCount?:  number;
  orderCount?:    number;
  customerCount?: number;
  shopName?:      string;
  userEmail?:     string;
  activePlan?:    string;
  daysLeft?:      number | null;
  isActiveSub?:   boolean;
  notificationCount?: number;
}

// Primary tabs (hardcoded order, matches business intent).
// "More" lives on top of PLATFORM_NAV + any BUSINESS_NAV items not in primary.
const PRIMARY_HREFS = new Set(['/dashboard', '/orders', '/customers', '/analytics']);

export function BottomNav({
  catNav,
  productCount    = 0,
  orderCount      = 0,
  customerCount   = 0,
  shopName        = 'My Business',
  userEmail       = '',
  activePlan      = 'trial',
  daysLeft,
  isActiveSub     = false,
  notificationCount = 0,
}: BottomNavProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [showMore, setShowMore] = useState(false);
  const [liveCount, setLiveCount] = useState(notificationCount);
  const [liveChatUnread, setLiveChatUnread] = useState(false);

  useEffect(() => { setLiveCount(notificationCount); }, [notificationCount]);
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications/count', { cache: 'no-store' });
        if (res.ok) { const { count, unreadLiveChat } = await res.json(); setLiveCount(count); setLiveChatUnread(!!unreadLiveChat); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const isBookingCategory = catNav?.ordersLabel === 'Appointments' || catNav?.ordersLabel === 'Bookings';

  const labelFor = (item: NavItem) => {
    if (item.labelKey && catNav) {
      const v = catNav[item.labelKey];
      if (v) return v;
    }
    return item.label;
  };
  const iconFor = (item: NavItem) =>
    isBookingCategory && item.bookingIcon ? item.bookingIcon : item.icon;
  const countFor = (item: NavItem): number | null => {
    switch (item.countKey) {
      case 'order':    return orderCount;
      case 'customer': return customerCount;
      case 'product':  return productCount;
      default:         return null;
    }
  };
  const shopMods = modules; // null-safe alias for closure

  // Primary tabs derived from BUSINESS_NAV in declared order; Analytics replaces Settings.
  // Filtered by module and category.
  const PRIMARY_NAV = BUSINESS_NAV.filter(i =>
    PRIMARY_HREFS.has(i.href) &&
    (!i.onlyModule || !shopMods || shopMods.includes(i.onlyModule))
  ).map(item => ({
    href: item.href,
    label: labelFor(item),
    Icon: iconFor(item),
    count: countFor(item),
  }));

  // Everything else falls into "More": leftover business items first, then platform.
  const shopMods = modules; // null-safe alias for closure

  // Primary tabs derived from BUSINESS_NAV in declared order; Analytics replaces Settings.
  // Filtered by module and category.
  const PRIMARY_NAV = BUSINESS_NAV.filter(i =>
    PRIMARY_HREFS.has(i.href) &&
    (!i.onlyModule || !shopMods || shopMods.includes(i.onlyModule))
  ).map(item => ({
    href: item.href,
    label: labelFor(item),
    Icon: iconFor(item),
    count: countFor(item),
  }));

  // Everything else falls into "More": leftover business items first, then platform.
  const shopMods = modules; // null-safe alias for closure

  // Primary tabs derived from BUSINESS_NAV in declared order; Analytics replaces Settings.
  // Filtered by module and category.
  const PRIMARY_NAV = BUSINESS_NAV.filter(i =>
    PRIMARY_HREFS.has(i.href) &&
    (!i.onlyModule || !shopMods || shopMods.includes(i.onlyModule))
  ).map(item => ({
    href: item.href,
    label: labelFor(item),
    Icon: iconFor(item),
    count: countFor(item),
  }));

  // Everything else falls into "More": leftover business items first, then platform.
  // Filtered by module and category.
  const MORE_ITEMS: Array<{ href: string; label: string; emoji: string; count: number | null; external?: boolean }> =
    [
      ...BUSINESS_NAV.filter(i => !PRIMARY_HREFS.has(i.href) && (!i.onlyModule || !shopMods || shopMods.includes(i.onlyModule))),
      ...PLATFORM_NAV.filter(i => !i.onlyModule || !shopMods || shopMods.includes(i.onlyModule)),
    ].map(item => ({
      href: item.href,
      label: labelFor(item),
      emoji: item.emoji ?? '•',
      count: countFor(item),
      external: item.external,
    }));

  const allNavItems = [...BUSINESS_NAV, ...PLATFORM_NAV];
  // For the bottom tab bar we want simple prefix match (no /settings/backup
  // vs /settings conflict here since Settings isn't in the primary tabs).
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  // For the More-sheet items, use the smart helper so hash items and
  // /settings vs /settings/backup highlight correctly.
  const isMoreItemActive = (href: string, external?: boolean) => {
    if (external) return false;
    const item = allNavItems.find(i => i.href === href);
    return item ? isNavItemActive(item, pathname, allNavItems) : false;
  };

  const moreIsActive = MORE_ITEMS.some(i => isMoreItemActive(i.href, i.external));

  const planLabel  = activePlan.charAt(0).toUpperCase() + activePlan.slice(1) + ' Plan';
  const planColor  =
    activePlan === 'business' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
    activePlan === 'pro'      ? 'text-cyan-400  bg-cyan-500/10  border-cyan-500/20'  :
    activePlan === 'starter'  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    'text-gray-400 bg-gray-700/50 border-gray-600/30';

  async function handleSignOut() {
    setShowMore(false);
    const result = await signOut();
    if (result?.redirect) router.push(result.redirect);
  }

  return (
    <>
      {/* ── Bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-gray-900/95 backdrop-blur-md border-t border-gray-800 flex items-center h-16 px-1 pb-safe">
          {PRIMARY_NAV.map(({ href, label, Icon, count }) => (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors"
            >
              <div className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                isActive(href) ? 'bg-emerald-600/15 text-emerald-400' : 'text-gray-500'
              }`}>
                <Icon size={20} />
                {count !== null && count > 0 && (
                  <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-emerald-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-1 leading-none">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold leading-none truncate max-w-[60px] ${
                isActive(href) ? 'text-emerald-400' : 'text-gray-500'
              }`}>
                {label}
              </span>
            </Link>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors"
          >
            <div className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
              moreIsActive || showMore ? 'bg-emerald-600/15 text-emerald-400' : 'text-gray-500'
            }`}>
              <LayoutGrid size={20} />
              {liveCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-red-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-1 leading-none">
                  {liveCount > 9 ? '9+' : liveCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold leading-none ${
              moreIsActive || showMore ? 'text-emerald-400' : 'text-gray-500'
            }`}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── Full-screen slide-up panel ── */}
      {showMore && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
          />

          {/* Panel */}
          <div
            className="relative bg-gray-900 rounded-t-3xl border-t border-gray-800 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 pb-safe">
              {/* Profile card */}
              <div className="mx-4 mt-2 mb-4 bg-gray-800 rounded-2xl border border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-emerald-400">
                        {shopName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{shopName}</p>
                      <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMore(false)}
                    className="p-2 rounded-xl hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${planColor}`}>
                    {planLabel}
                  </span>
                  {daysLeft !== null && daysLeft !== undefined && (
                    <span className="text-[11px] text-gray-500">
                      {isActiveSub && activePlan !== 'trial' ? `${daysLeft}d until renewal` : `${daysLeft}d remaining`}
                    </span>
                  )}
                  {liveCount > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-red-400">
                      <Bell size={11} />
                      {liveCount} alert{liveCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Nav items */}
              <div className="px-4 space-y-1 mb-4">
                {MORE_ITEMS.map(({ href, label, emoji, count, external }) => {
                  const itemActive = isMoreItemActive(href, external);
                  const className = `flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-colors ${
                    itemActive
                      ? 'bg-emerald-600/12 border border-emerald-600/25 text-emerald-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-700'
                  }`;
                  const labelClass = `flex-1 text-sm font-semibold ${itemActive ? 'text-emerald-400' : 'text-white'}`;
                  const inner = (
                    <>
                      <span className="text-xl w-7 text-center shrink-0">{emoji}</span>
                      <span className={labelClass}>{label}</span>
                      {href === '/livechat' && liveChatUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      {count !== null && count !== undefined && count > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          itemActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {count > 999 ? '999+' : count}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-gray-600 shrink-0" />
                    </>
                  );
                  return external ? (
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={() => setShowMore(false)} className={className}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={href} href={href} onClick={() => setShowMore(false)} className={className}>
                      {inner}
                    </Link>
                  );
                })}
              </div>

              {/* Sign out */}
              <div className="px-4 pb-6">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-semibold active:bg-red-500/20 transition-colors"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

