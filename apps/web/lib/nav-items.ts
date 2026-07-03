/**
 * Shared nav config used by Sidebar (desktop) and BottomNav (mobile).
 *
 * Two groups:
 *   - BUSINESS: top-level items in the desktop sidebar + primary mobile tabs
 *   - PLATFORM: collapsible "Platform & Tools" on desktop, "More" sheet on mobile
 *
 * To add a future module, add ONE line here — Sidebar + BottomNav both pick it up.
 */
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Calendar,
  Users,
  UserPlus,
  BarChart2,
  MessageSquare,
  MessagesSquare,
  CreditCard,
  Link2,
  Radio,
  Brain,
  LifeBuoy,
  Settings,
  ExternalLink,
  Code2,
  CalendarDays,
  Archive,
  ClockArrowUp,
  type LucideIcon,
} from 'lucide-react';

export type CountKey = 'order' | 'customer' | 'product' | null;

export interface NavItem {
  href: string;
  label: string;     // fallback label; category-aware Sidebar/BottomNav swap this
  icon: LucideIcon;
  emoji?: string;    // mobile More sheet uses emoji instead of icon
  countKey?: CountKey;
  external?: boolean;
  /** Category-aware label key (mapped at render-time from CategoryNav). */
  labelKey?: 'productsLabel' | 'ordersLabel' | 'customersLabel';
  /** If set, swap the icon when the category is appointment-based (clinic/salon/services). */
  bookingIcon?: LucideIcon;
  /** If set, only shown when shop category matches. */
  onlyCategory?: string;
  /**
   * If set, only shown + accessible when the corresponding module is enabled.
   * The module key must exist in lib/modules.ts.
   */
  onlyModule?: string;
}

// ── BUSINESS modules: always top-level on desktop, primary tabs on mobile ──
// Order here = order in the desktop sidebar.
export const BUSINESS_NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard                                                                  },
  { href: '/scheduling',  label: 'Scheduling',  icon: ClockArrowUp,                                                      emoji: '🗓️',   onlyCategory: 'clinic' },
  { href: '/orders',      label: 'Orders',      icon: ShoppingBag,    labelKey: 'ordersLabel',    countKey: 'order',    emoji: '📋',
                                                bookingIcon: Calendar                                                                  },
  { href: '/customers',   label: 'Customers',   icon: Users,          labelKey: 'customersLabel', countKey: 'customer', emoji: '👥'   },
  { href: '/leads',       label: 'Leads',       icon: UserPlus,                                                          emoji: '🌟'   },
  { href: '/products',    label: 'Products',    icon: Package,        labelKey: 'productsLabel',  countKey: 'product',  emoji: '📦'   },
  { href: '/analytics',   label: 'Analytics',   icon: BarChart2,                                                         emoji: '📊'   },
  { href: '/transcripts', label: 'Transcripts', icon: MessageSquare,                                                     emoji: '💬'   },
  { href: '/livechat',    label: 'Live Chat',   icon: MessagesSquare,   onlyModule: 'livechat',                          emoji: '💭'   },
];

// ── PLATFORM & TOOLS: collapsed on desktop, "More" sheet on mobile ──
// Add new platform-level features here — Sidebar + BottomNav pick them up.
// Hash-targeted hrefs (e.g. /integrations#google-calendar) deep-link to
// sections inside an existing page; the section IDs are set in that page.
export const PLATFORM_NAV: NavItem[] = [
  { href: '/billing',                       label: 'Billing',          icon: CreditCard,   emoji: '💳' },
  { href: '/integrations',                  label: 'Integrations',     icon: Link2,        emoji: '🔗' },
  { href: '/integrations#api-access',       label: 'API Access',       icon: Code2,        emoji: '🧩', onlyModule: 'api_access' },
  { href: '/integrations#google-calendar',  label: 'Google Calendar',  icon: CalendarDays, emoji: '📅', onlyModule: 'calendar' },
  { href: '/voice-links',                   label: 'Voice Links',      icon: Radio,        emoji: '📡', onlyModule: 'voice_links' },
  { href: '/training',                      label: 'AI Training',      icon: Brain,        emoji: '🧠' },
  { href: '/settings/backup',               label: 'Backup & Restore', icon: Archive,      emoji: '🗄️' },
  { href: '/support',                       label: 'Support',          icon: LifeBuoy,     emoji: '🎧' },
  { href: '/settings',                      label: 'Settings',         icon: Settings,     emoji: '⚙️' },
  { href: 'https://kothabot.ai.bd/docs',    label: 'Documentation',    icon: ExternalLink, emoji: '📖', external: true },
];

/**
 * Active-state helper used by both Sidebar and BottomNav.
 * Picks the most-specific matching item so e.g. on /settings/backup,
 * "Backup & Restore" highlights but "Settings" does NOT.
 * Items with a hash in their href never light up (pathname has no hash).
 */
export function isNavItemActive(item: NavItem, pathname: string, allItems: NavItem[]): boolean {
  if (item.external) return false;
  if (item.href.includes('#')) return false;

  if (pathname === item.href) return true;
  if (!pathname.startsWith(item.href + '/')) return false;

  // Suppress if a more-specific item also matches (e.g. /settings vs /settings/backup).
  const moreSpecific = allItems.some(other => {
    if (other === item || other.external || other.href.includes('#')) return false;
    if (other.href.length <= item.href.length) return false;
    return pathname === other.href || pathname.startsWith(other.href + '/');
  });
  return !moreSpecific;
}
