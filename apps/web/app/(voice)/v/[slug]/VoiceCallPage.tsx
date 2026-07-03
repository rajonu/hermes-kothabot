'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';

interface VoiceCallPageProps {
  shopId: string;
  shopName: string;
  slug: string;
  title: string;
  description: string;
  themeColor: string;
  greetingMessage: string | null;
  avatar: string | null;
}

export function VoiceCallPage({
  shopId,
  shopName,
  slug,
  title,
  description,
  themeColor,
  greetingMessage,
  avatar,
}: VoiceCallPageProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'active'>('idle');
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const handleStartCall = useCallback(async () => {
    setPhase('loading');

    // Track event — fire and forget
    try {
      await fetch('/api/voice-links/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, event: 'voice_start' }),
      });
    } catch {
      // non-blocking
    }

    setPhase('active');
  }, [slug]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setIframeLoaded(false);
  }, []);

  const widgetUrl = `/widget/${shopId}`;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#111827', fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Card */}
      <div
        style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '1.5rem',
          maxWidth: '420px',
          width: '100%',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Avatar */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          {avatar ? (
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: `3px solid ${themeColor}`,
                boxShadow: `0 0 0 4px ${themeColor}22`,
              }}
            >
              <Image
                src={avatar}
                alt={shopName}
                width={88}
                height={88}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                background: `linear-gradient(135deg, ${themeColor}33, ${themeColor}11)`,
                border: `3px solid ${themeColor}`,
                boxShadow: `0 0 0 4px ${themeColor}22`,
              }}
            >
              {shopName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Title */}
        <h1
          style={{
            color: '#f9fafb',
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0 0 0.5rem',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>

        {/* Description */}
        <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
          {description}
        </p>

        {/* Greeting */}
        {greetingMessage && (
          <p
            style={{
              color: '#d1fae5',
              fontSize: '0.875rem',
              margin: '0.75rem 0 0',
              padding: '0.75rem 1rem',
              backgroundColor: `${themeColor}18`,
              border: `1px solid ${themeColor}33`,
              borderRadius: '0.75rem',
              lineHeight: 1.5,
            }}
          >
            {greetingMessage}
          </p>
        )}

        {/* Start button */}
        <button
          onClick={handleStartCall}
          disabled={phase !== 'idle'}
          style={{
            marginTop: '2rem',
            width: '100%',
            padding: '0.875rem 1.5rem',
            borderRadius: '0.875rem',
            border: 'none',
            cursor: phase === 'idle' ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#fff',
            background:
              phase === 'idle'
                ? `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`
                : '#374151',
            boxShadow: phase === 'idle' ? `0 4px 20px ${themeColor}44` : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {phase === 'loading' ? (
            <>
              <SpinnerIcon />
              Connecting...
            </>
          ) : (
            <>
              <PhoneIcon color="#fff" />
              Start Voice Call
            </>
          )}
        </button>

        {/* Powered by */}
        <p style={{ marginTop: '1.5rem', color: '#4b5563', fontSize: '0.75rem' }}>
          Powered by{' '}
          <span style={{ color: themeColor, fontWeight: 600 }}>KothaBot</span>
        </p>
      </div>

      {/* Widget overlay modal */}
      {phase === 'active' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#374151',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              color: '#f9fafb',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            &times;
          </button>

          {/* Loading indicator while iframe initializes */}
          {!iframeLoaded && (
            <div style={{ position: 'absolute', color: '#9ca3af', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SpinnerIcon />
              Loading widget...
            </div>
          )}

          <iframe
            src={widgetUrl}
            onLoad={() => setIframeLoaded(true)}
            style={{
              width: '100%',
              maxWidth: '480px',
              height: '90vh',
              border: 'none',
              borderRadius: '1rem',
              opacity: iframeLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            title={`${shopName} AI Assistant`}
            allow="microphone; camera"
          />
        </div>
      )}
    </div>
  );
}

function PhoneIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.06 6.06l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
