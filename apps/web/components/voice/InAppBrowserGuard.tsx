'use client';

import { useState, useEffect } from 'react';
import {
  isInAppBrowser,
  getInAppBrowserType,
  isAndroid,
  isIOS,
} from '@/lib/inapp-browser';
import { InAppBrowserModal } from './InAppBrowserModal';

interface Props {
  children: React.ReactNode;
  slug: string;
  enabled?: boolean;
}

const BROWSER_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

export function InAppBrowserGuard({ children, slug, enabled = true }: Props) {
  const [modalDismissed, setModalDismissed] = useState(false);
  const [detected, setDetected] = useState<{ platform: 'android' | 'ios'; name: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!isInAppBrowser()) return;

    const browserType = getInAppBrowserType();
    const browserName = browserType ? (BROWSER_NAMES[browserType] ?? 'This app') : 'This app';

    // Track detection
    fetch('/api/voice-links/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, event: 'inapp_detected', browser_type: browserType }),
    }).catch(() => {});

    if (isAndroid()) {
      setDetected({ platform: 'android', name: browserName });
    } else if (isIOS()) {
      setDetected({ platform: 'ios', name: browserName });
    }
    // For other platforms (desktop) we skip the modal — rare case
  }, [enabled, slug]);

  if (detected && !modalDismissed) {
    return (
      <>
        {children}
        <InAppBrowserModal
          type={detected.platform}
          browserName={detected.name}
          slug={slug}
          onContinueAnyway={() => setModalDismissed(true)}
        />
      </>
    );
  }

  return <>{children}</>;
}
