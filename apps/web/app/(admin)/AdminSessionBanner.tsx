'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut, AlertTriangle } from 'lucide-react';

export function AdminSessionBanner({ remainingMins }: { remainingMins: number }) {
  const router = useRouter();
  const [mins, setMins] = useState(remainingMins);

  // Count down every minute
  useEffect(() => {
    const id = setInterval(() => {
      setMins(m => {
        if (m <= 1) {
          clearInterval(id);
          // Session expired — redirect to PIN page
          router.push('/admin-login');
          return 0;
        }
        return m - 1;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [router]);

  const isWarning = mins <= 15;
  const isDanger  = mins <= 5;

  return (
    <div className={`flex items-center justify-between px-5 py-2 text-xs border-b ${
      isDanger  ? 'bg-red-600/20 border-red-600/40 text-red-300' :
      isWarning ? 'bg-amber-600/20 border-amber-600/40 text-amber-300' :
                  'bg-gray-900 border-gray-800 text-gray-500'
    }`}>
      <div className="flex items-center gap-2">
        {isDanger || isWarning
          ? <AlertTriangle size={13} />
          : <Shield size={13} className="text-red-500" />}
        <span>
          {isDanger  ? `⚠ Admin session expires in ${mins} minute${mins !== 1 ? 's' : ''}! Save your work.` :
           isWarning ? `Admin session expires in ${mins} minutes` :
                       `Admin session · ${mins} minutes remaining`}
        </span>
      </div>
      <button
        onClick={() => {
          fetch('/api/admin/logout', { method: 'POST' }).then(() => router.push('/admin-login'));
        }}
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <LogOut size={12} /> Lock Admin
      </button>
    </div>
  );
}
