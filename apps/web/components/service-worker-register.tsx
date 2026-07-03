'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { BUILD_NUMBER } from '@/lib/version';

export function ServiceWorkerRegister() {
  const currentBuild = useRef(BUILD_NUMBER);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    async function checkVersion() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (build > currentBuild.current) {
          currentBuild.current = build;
          toast('New version available', {
            description: `Build ${build} is ready.`,
            duration: Infinity,
            action: { label: 'Reload', onClick: () => window.location.reload() },
          });
        }
      } catch {}
    }

    const onVisible = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setTimeout(checkVersion, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(timer);
    };
  }, []);

  return null;
}
