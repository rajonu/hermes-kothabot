import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KothaBot — AI Voice Assistant for Your Business",
  description: "AI-powered voice assistant that handles customer calls, takes orders, and grows your business 24/7.",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/kotha-logo.png',
    apple: '/apple-icon.png',
    shortcut: '/kotha-logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KothaBot',
  },
  // Meta Business Manager domain verification (Brand Safety > Domains > kothabot.ai.bd)
  other: {
    'facebook-domain-verification': 'h2afx8aawjr3zb4v77cq2ho63x4d16',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-[#09110e] text-[#e8f5e9]">
        <Providers>
          {children}
        </Providers>
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
