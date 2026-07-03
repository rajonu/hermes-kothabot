import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // HTML pages — never cache, always re-fetch from server
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Pragma',        value: 'no-cache' },
        { key: 'Expires',       value: '0' },
      ],
    },
    {
      // Next.js content-hashed static chunks — safe to cache forever
      source: '/_next/static/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
    // Restricted to Supabase storage — wildcard '**' made the image optimizer
    // an open proxy for any URL on the internet (abuse/cost risk).
    // Avatars are base64 data URLs and QR images use `unoptimized`, so no
    // other remote hosts go through the optimizer.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jrlfbfejeccsixnxhuwo.supabase.co',
      },
    ],
  },
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
  },
};

export default nextConfig;
