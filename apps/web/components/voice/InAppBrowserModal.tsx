'use client';

import { useEffect } from 'react';
import { getAndroidIntentUrl } from '@/lib/inapp-browser';

interface Props {
  type: 'android' | 'ios';
  browserName: string;
  onContinueAnyway: () => void;
  slug: string;
}

export function InAppBrowserModal({ type, browserName, onContinueAnyway, slug }: Props) {
  // Track that the modal was shown
  useEffect(() => {
    fetch('/api/voice-links/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, event: type === 'ios' ? 'inapp_safari_shown' : 'inapp_detected' }),
    }).catch(() => {});
  }, [slug, type]);

  const handleOpenChrome = () => {
    fetch('/api/voice-links/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, event: 'inapp_open_chrome' }),
    }).catch(() => {});
    window.location.href = getAndroidIntentUrl(window.location.href);
  };

  const handleContinueAnyway = () => {
    fetch('/api/voice-links/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, event: 'inapp_continue_anyway' }),
    }).catch(() => {});
    onContinueAnyway();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div
        style={{
          backgroundColor: '#1a1f2e',
          border: '1px solid #2d3748',
          borderRadius: '1.25rem',
          padding: '1.75rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.25s ease',
          marginBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b98122, #10b98111)',
            border: '2px solid #10b98140',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem',
          }}>
            {type === 'ios' ? '🧭' : '🌐'}
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          color: '#f9fafb',
          fontSize: '1.25rem',
          fontWeight: 700,
          textAlign: 'center',
          margin: '0 0 0.75rem',
        }}>
          {type === 'ios' ? 'Open in Safari' : 'Open in Chrome'}
        </h2>

        {/* Message */}
        <p style={{
          color: '#9ca3af',
          fontSize: '0.9rem',
          textAlign: 'center',
          margin: '0 0 1.25rem',
          lineHeight: 1.55,
        }}>
          {type === 'ios'
            ? `${browserName} may block microphone access.`
            : `For the best voice experience and microphone access, please open this page in Google Chrome.`}
        </p>

        {/* iOS instructions */}
        {type === 'ios' && (
          <div style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '0.875rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
          }}>
            <p style={{ color: '#d1d5db', fontSize: '0.8rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              How to open in Safari:
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.7 }}>
              <li>Tap the <strong style={{ color: '#d1d5db' }}>Share</strong> or <strong style={{ color: '#d1d5db' }}>More (⋯)</strong> menu</li>
              <li>Select <strong style={{ color: '#10b981' }}>Open in Safari</strong> or <strong style={{ color: '#10b981' }}>Open in Browser</strong></li>
              <li>Return here to continue</li>
            </ol>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {type === 'android' ? (
            <button
              onClick={handleOpenChrome}
              style={{
                padding: '0.875rem',
                borderRadius: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#fff',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 16px #10b98140',
              }}
            >
              Open in Chrome
            </button>
          ) : (
            <button
              onClick={handleContinueAnyway}
              style={{
                padding: '0.875rem',
                borderRadius: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#fff',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 16px #10b98140',
              }}
            >
              Got It
            </button>
          )}

          <button
            onClick={handleContinueAnyway}
            style={{
              padding: '0.75rem',
              borderRadius: '0.875rem',
              border: '1px solid #374151',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#6b7280',
              background: 'transparent',
            }}
          >
            Continue Anyway
          </button>
        </div>

        {/* KothaBot branding */}
        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#374151', fontSize: '0.7rem' }}>
          Powered by <span style={{ color: '#10b981', fontWeight: 600 }}>KothaBot</span>
        </p>
      </div>
    </div>
  );
}
