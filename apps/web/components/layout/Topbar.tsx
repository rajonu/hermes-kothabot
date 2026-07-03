"use client";

import { Bell, LogOut, User, ShieldCheck, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { signOut } from "@/modules/auth/actions";
import { ADMIN_EMAILS } from "@/lib/admin";

interface TopbarProps {
  shopName?: string;
  userEmail?: string;
  avatar?: string | null;
  notificationCount?: number;
}

export function Topbar({ shopName = "My Shop", userEmail, avatar, notificationCount = 0 }: TopbarProps) {
  const router             = useRouter();
  const [open, setOpen]    = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(notificationCount);
  const dropdownRef        = useRef<HTMLDivElement>(null);
  const bellRef            = useRef<HTMLDivElement>(null);

  // Poll every 30s so the bell updates without a page refresh
  useEffect(() => {
    setLiveCount(notificationCount);
  }, [notificationCount]);
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications/count', { cache: 'no-store' });
        if (res.ok) { const { count } = await res.json(); setLiveCount(count); }
      } catch {}
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    if (bellOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bellOpen]);

  async function handleSignOut() {
    setOpen(false);
    const result = await signOut();
    if (result?.redirect) router.push(result.redirect);
  }

  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 h-14 border-b border-gray-800 bg-gray-900 shrink-0">
      {/* Mobile: Logo */}
      <div className="flex items-center gap-2 md:hidden">
        <Image src="/kotha-logo.png" alt="KothaBot" width={28} height={28} className="rounded-lg" />
        <span className="text-sm font-bold text-white">KothaBot</span>
      </div>

      {/* Desktop: Shop name */}
      <span className="hidden md:block text-sm font-semibold text-white truncate max-w-[200px]">
        {shopName}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        {/* Bell with notification dot */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {liveCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-gray-900" />
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Notifications</p>
                {liveCount > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                    {liveCount} new
                  </span>
                )}
              </div>
              {liveCount === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-gray-500">All caught up! No pending items.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  <Link href="/orders?status=pending" onClick={() => setBellOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
                    <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white">Pending appointments</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Review and confirm new bookings</p>
                    </div>
                  </Link>
                  <Link href="/support" onClick={() => setBellOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white">Support messages</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Unread messages from patients</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User dropdown — CLICK based, no hover gap issue */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800 border text-sm text-white transition-colors ${
              open ? 'border-emerald-600/50' : 'border-gray-700 hover:border-emerald-600/40'
            }`}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-emerald-600/30 shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0">
                <User size={12} className="text-emerald-400" />
              </div>
            )}
            <span className="hidden sm:block text-xs text-gray-400 max-w-[120px] truncate">
              {userEmail ?? "Account"}
            </span>
            <ChevronDown size={12} className={`text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown — always rendered, toggled by open state */}
          {open && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/50">
                <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                <p className="text-xs font-semibold text-white truncate mt-0.5">{shopName}</p>
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
