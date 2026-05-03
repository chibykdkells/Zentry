import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: !!process.env.SENTRY_DSN,
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

function bigIntToJSON(this: bigint): string {
  return this.toString();
}

// BigInt JSON serialization — allows wallet balances to be serialized as strings
Object.defineProperty(BigInt.prototype, 'toJSON', {
  value: bigIntToJSON,
  configurable: true,
  writable: true,
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for webhook signature verification
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'debug', 'error', 'warn', 'verbose'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 4000);
  const isProduction = config.get('NODE_ENV') === 'production';
  const allowedOrigins = config
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const platformDomain = config.get<string>('PLATFORM_DOMAIN', 'zendocx.net');

  const isPrivateDevHostname = (hostname: string) => {
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  };

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
          }
        : false,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_: Request, response: Response, next: NextFunction) => {
    response.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );
    next();
  });

  app.enableCors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // Allow all tenant subdomains: acme.zendocx.net, etc.
      try {
        const { hostname, protocol } = new URL(origin);
        if (protocol === 'https:' && hostname.endsWith(`.${platformDomain}`)) {
          callback(null, true);
          return;
        }
      } catch {
        // fall through to rejection
      }

      if (!isProduction) {
        try {
          const url = new URL(origin);
          const isAllowedDevPort = url.port === '3000';

          if (isAllowedDevPort && isPrivateDevHostname(url.hostname)) {
            callback(null, true);
            return;
          }
        } catch {
          // fall through to rejection
        }
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug'],
  });

  app.useGlobalPipes(
    new ZodValidationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1', { exclude: ['/health'] });

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 ZenDocx API running on http://0.0.0.0:${port}/api/v1`);
}

void bootstrap();
