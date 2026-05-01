import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const require = createRequire(import.meta.url);
const isDevelopment = process.env.NODE_ENV === 'development';
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function getLocalInterfaceOrigins(port: number): string[] {
  const interfaces = os.networkInterfaces();
  const origins = new Set<string>([
    `http://localhost:${port}`,
    `ws://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `ws://127.0.0.1:${port}`,
  ]);

  for (const networkInterface of Object.values(interfaces)) {
    for (const address of networkInterface ?? []) {
      if (address.internal) {
        continue;
      }

      if (address.family === 'IPv4') {
        origins.add(`http://${address.address}:${port}`);
        origins.add(`ws://${address.address}:${port}`);
      }
    }
  }

  return Array.from(origins);
}

function toWebSocketOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.origin;
  } catch {
    return null;
  }
}

const devAppSources: string[] = Array.from(
  new Set(
    [
      ...getLocalInterfaceOrigins(3000),
      appOrigin,
      toWebSocketOrigin(appOrigin),
    ].filter((value): value is string => Boolean(value)),
  ),
);

const connectSources = [
  "'self'",
  ...(isDevelopment ? ['http:', 'ws:'] : [apiOrigin]),
  ...(isDevelopment ? devAppSources : []),
].filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `connect-src ${connectSources.join(' ')}`,
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  isDevelopment ? '' : 'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // App shell — always serve from cache, revalidate in background
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    // Service catalog — stale-while-revalidate so it works offline
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.pathname.includes('/services/catalog'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'service-catalog',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Order history — network first, fall back to cache for offline reading
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.pathname.includes('/orders/me'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'order-history',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 5,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Wallet balance — network first with short cache for offline fallback
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.pathname.includes('/wallet/me'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'wallet-data',
        expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
        networkTimeoutSeconds: 5,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Profile — network first
    {
      urlPattern: ({ url }: { url: URL }) =>
        url.pathname.includes('/users/me') || url.pathname.includes('/auth/me'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'user-profile',
        expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 4 },
        networkTimeoutSeconds: 5,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  poweredByHeader: false,
  allowedDevOrigins: isDevelopment ? devAppSources : undefined,
  async rewrites() {
    if (!isDevelopment) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          ...(isDevelopment
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]),
        ],
      },
    ];
  },
};

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
};

export default withSentryConfig(withPWA(nextConfig), sentryConfig);
