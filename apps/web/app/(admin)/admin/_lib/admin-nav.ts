import {
  LayoutDashboard, Users, CreditCard, Brain, Plug, Server, Settings,
  ShoppingBag, MessageSquare, Mail, Archive, Code2, CalendarDays,
  ShieldAlert, Sliders, Mic, Globe, FileText, Activity,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: any;
  badge?: 'pendingPayments' | 'unreadTickets';
}

export interface AdminNavGroup {
  label: string;
  icon: any;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Clients',
    icon: Users,
    items: [
      { label: 'All Clients', href: '/admin/clients', icon: Users },
      { label: 'Knowledge', href: '/admin/knowledge', icon: Brain },
      { label: 'Backups', href: '/admin/backups', icon: Archive },
    ],
  },
  {
    label: 'Billing',
    icon: CreditCard,
    items: [
      { label: 'Payments', href: '/admin/payments', icon: CreditCard, badge: 'pendingPayments' },
      { label: 'Plans', href: '/admin/settings/plans', icon: ShoppingBag },
      { label: 'Payment Methods', href: '/admin/settings/payment-methods', icon: Globe },
      { label: 'Trial Extensions', href: '/admin/settings/trial-extensions', icon: FileText },
    ],
  },
  {
    label: 'AI Platform',
    icon: Brain,
    items: [
      { label: 'Global AI Rules', href: '/admin/settings/ai-rules', icon: Brain },
      { label: 'Category Prompts', href: '/admin/settings/category-prompts', icon: FileText },
      { label: 'Voice Protection', href: '/admin/settings/voice-protection', icon: Mic },
    ],
  },
  {
    label: 'Integrations',
    icon: Plug,
    items: [
      { label: 'SIP Providers', href: '/admin/settings/sip', icon: Mic },
      { label: 'API Keys', href: '/admin/api', icon: Code2 },
      { label: 'Calendar', href: '/admin/calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Operations',
    icon: Server,
    items: [
      { label: 'Support', href: '/admin/support', icon: MessageSquare, badge: 'unreadTickets' },
      { label: 'Emails', href: '/admin/emails', icon: Mail },
      { label: 'Audit Log', href: '/admin/audit', icon: ShieldAlert },
    ],
  },
  {
    label: 'Platform',
    icon: Settings,
    items: [
      { label: 'Categories', href: '/admin/settings/categories', icon: Sliders },
      { label: 'Voice Links', href: '/admin/settings/voice-links', icon: Activity },
      { label: 'All Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

export function isAdminNavActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

export function getActiveGroup(pathname: string): string | null {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (isAdminNavActive(item.href, pathname)) return group.label;
    }
  }
  if (pathname.startsWith('/admin/shops/')) return 'Clients';
  return null;
}
