"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_VERSION, BUILD_NUMBER } from "@/lib/version";
import { isModuleEnabled } from "@/lib/modules";
import type { CategoryNav } from "@/lib/category-nav";
import { BUSINESS_NAV, PLATFORM_NAV, isNavItemActive, type NavItem } from "@/lib/nav-items";

interface SidebarProps {
  activePlan?:    string;
  isActiveSub?:   boolean;
  daysLeft?:      number | null;
  catNav?:        CategoryNav;
  shopCategory?:  string;
  productCount?:  number;
  orderCount?:    number;
  customerCount?: number;
  modules?:       string[] | null;
}

export function Sidebar({
  activePlan    = 'trial',
  isActiveSub   = false,
  daysLeft,
  catNav,
  shopCategory,
  productCount  = 0,
  orderCount    = 0,
  customerCount = 0,
  modules       = null,
}: SidebarProps) {
  const pathname = usePathname();

  // Poll every 30s for a new live-chat message dot (mirrors Topbar's bell poll)
  const [liveChatUnread, setLiveChatUnread] = useState(false);
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications/count', { cache: 'no-store' });
        if (res.ok) { const { unreadLiveChat } = await res.json(); setLiveChatUnread(!!unreadLiveChat); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  // Calendar icon for appointment-style categories (clinic/salon/services).
  const isBookingCategory = catNav?.ordersLabel === 'Appointments' || catNav?.ordersLabel === 'Bookings';

  const shopMods = modules; // null-safe alias for closure

  const visibleBusiness = BUSINESS_NAV.filter(
    item =>
      (!item.onlyCategory || item.onlyCategory === shopCategory) &&
      (!item.onlyModule || !shopMods || shopMods.includes(item.onlyModule))
  );
  const visiblePlatform = PLATFORM_NAV.filter(
    item => !item.onlyModule || !shopMods || shopMods.includes(item.onlyModule)
  );
  const allNavItems = [...visibleBusiness, ...visiblePlatform];
  const platformIsActive = PLATFORM_NAV.some(item => isNavItemActive(item, pathname, allNavItems));
  const [platformOpen, setPlatformOpen] = useState(platformIsActive);

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

  const renderItem = (item: NavItem) => {
    const Icon = iconFor(item);
    const active = isNavItemActive(item, pathname, allNavItems);
    const count = countFor(item);
    const linkClasses = cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-emerald-600/10 text-emerald-400 border border-emerald-600/20"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    );
    const content = (
      <>
        <Icon size={17} />
        <span className="flex-1">{labelFor(item)}</span>
        {item.href === '/livechat' && liveChatUnread && (
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        )}
        {count !== null && count > 0 && (
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none",
            active
              ? "bg-emerald-500/30 text-emerald-300"
              : "bg-gray-700 text-gray-300"
          )}>
            {count > 999 ? '999+' : count}
          </span>
        )}
      </>
    );

    if (item.external) {
      return (
        <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={linkClasses}>
          {content}
        </a>
      );
    }
    return (
      <Link key={item.href} href={item.href} className={linkClasses}>
        {content}
      </Link>
    );
  };

  const planLabel = activePlan.charAt(0).toUpperCase() + activePlan.slice(1) + ' Plan';
  const planColor =
    activePlan === 'business' ? '#f59e0b' :
    activePlan === 'pro'      ? '#06b6d4' :
    activePlan === 'starter'  ? '#10b981' :
    '#9ca3af';

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-gray-800 bg-gray-900 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
        <Image src="/kotha-logo.png" alt="KothaBot" width={32} height={32} className="rounded-lg" />
        <span className="font-bold text-white tracking-tight">KothaBot</span>
        <span className="text-[10px] text-amber-400 font-mono bg-amber-600/10 px-1.5 py-0.5 rounded-full border border-amber-600/20 ml-auto">
          Beta
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* Business modules */}
        {visibleBusiness.map(renderItem)}

        {/* Platform & Tools — collapsible */}
        <div className="pt-3 mt-1 border-t border-gray-800/70">
          <button
            type="button"
            onClick={() => setPlatformOpen(o => !o)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors",
              platformIsActive
                ? "text-emerald-400"
                : "text-gray-500 hover:text-gray-300"
            )}
            aria-expanded={platformOpen}
          >
            <Layers size={13} />
            <span className="flex-1 text-left">Platform &amp; Tools</span>
            <ChevronDown
              size={14}
              className={cn("transition-transform", platformOpen ? "" : "-rotate-90")}
            />
          </button>
          {platformOpen && (
            <div className="space-y-0.5 mt-1">
              {visiblePlatform.map(renderItem)}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-4 space-y-2">
        <div className={`px-3 py-2.5 rounded-lg text-xs ${
          isActiveSub && activePlan !== 'trial' ? 'bg-gray-800 border border-gray-700' : 'bg-gray-800'
        }`}>
          <p className="font-semibold" style={{ color: planColor }}>{planLabel}</p>
          <p className="text-gray-400 mt-0.5">
            {isActiveSub && activePlan !== 'trial'
              ? daysLeft !== null ? `${daysLeft} days until renewal` : 'Active'
              : daysLeft !== null ? `${daysLeft} days remaining` : 'Free trial'
            }
          </p>
        </div>
        <p className="text-center text-[10px] font-mono text-gray-600 select-none">
          v{APP_VERSION} · build {BUILD_NUMBER}
        </p>
      </div>
    </aside>
  );
}
