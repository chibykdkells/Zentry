import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import Script from 'next/script';
import { AppProviders } from './app-providers';
import { getTenantThemeBootstrapScript } from '@/lib/tenant-theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZenDocx — Digital service portals for modern businesses',
  description:
    'White-label service portals for paperwork, registrations, payments, and customer support workflows.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ZenDocx',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
    shortcut: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D1B3E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <Script
          id="tenant-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: getTenantThemeBootstrapScript(),
          }}
        />
      </head>
      <body className="min-h-full bg-brand-canvas font-sans text-brand-ink">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
