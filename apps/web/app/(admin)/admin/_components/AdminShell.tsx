'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { ADMIN_NAV, isAdminNavActive, getActiveGroup } from '../_lib/admin-nav';
import { APP_VERSION, BUILD_NUMBER } from '@/lib/version';

interface AdminShellProps {
  children: React.ReactNode;
  badges?: { pendingPayments?: number; unreadTickets?: number };
}

export default function AdminShell({ children, badges = {} }: AdminShellProps) {
  const pathname = usePathname();
  const activeGroup = getActiveGroup(pathname);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeGroup) initial.add(activeGroup);
    return initial;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const badgeMap: Record<string, number | undefined> = {
    pendingPayments: badges.pendingPayments,
    unreadTickets: badges.unreadTickets,
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-800">
        <Image src="/kotha-logo.png" alt="KothaBot" width={28} height={28} className="rounded-lg" />
        <div>
          <p className="text-xs font-bold text-white leading-none">Master Admin</p>
          <p className="text-[9px] text-gray-500 font-mono mt-0.5">v{APP_VERSION} · build {BUILD_NUMBER}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {ADMIN_NAV.map((group) => {
          const isOpen = openGroups.has(group.label) || activeGroup === group.label;
          const GroupIcon = group.icon;
          const groupBadge = group.items.reduce((sum, item) => {
            if (item.badge) return sum + (badgeMap[item.badge] ?? 0);
            return sum;
          }, 0);
          return (
            <div key={group.label}>
              <button
                className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isOpen ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => toggleGroup(group.label)}
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2">
                  <GroupIcon size={13} />
                  {group.label}
                  {!isOpen && groupBadge > 0 && (
                    <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {groupBadge}
                    </span>
                  )}
                </span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
              </button>

              {isOpen && (
                <div className="space-y-px pb-1">
                  {group.items.map((item) => {
                    const active = isAdminNavActive(item.href, pathname);
                    const Icon = item.icon;
                    const badgeCount = item.badge ? badgeMap[item.badge] : undefined;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-4 pl-9 py-2 text-[13px] transition-colors ${
                          active
                            ? 'text-white bg-emerald-600/10 border-r-2 border-emerald-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        <Icon size={14} />
                        <span className="flex-1">{item.label}</span>
                        {badgeCount != null && badgeCount > 0 && (
                          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-800 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
          ← Back to Dashboard
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-10">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Image src="/kotha-logo.png" alt="KothaBot" width={24} height={24} className="rounded-lg" />
            <p className="text-xs font-bold text-white">Master Admin</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
