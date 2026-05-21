import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/verify-email'],
        disallow: [
          '/admin',
          '/admin/',
          '/platform',
          '/platform/',
          '/dashboard',
          '/orders',
          '/wallet',
          '/notifications',
          '/profile',
          '/security',
          '/support',
          '/tenant',
          '/tenant/',
          '/home',
          '/job-pool',
          '/my-jobs',
          '/earnings',
          '/withdraw',
          '/disputes',
        ],
      },
    ],
  };
}
