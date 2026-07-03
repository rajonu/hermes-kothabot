import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KothaBot — AI Voice Assistant',
    short_name: 'KothaBot',
    description: 'AI-powered voice assistant for Bangladeshi businesses',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#10b981',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    categories: ['business', 'productivity'],
    lang: 'en',
  };
}
