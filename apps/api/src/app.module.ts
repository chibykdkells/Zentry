import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';

import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ServicesModule } from './modules/services/services.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProvidersModule } from './providers/providers.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env', '../.env', '../../.env'],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>(
          'REDIS_URL',
          'redis://localhost:6379',
        );
        const parsedUrl = new URL(redisUrl);
        const database = Number(parsedUrl.pathname.replace('/', '') || '0');

        return {
          redis: {
            host: parsedUrl.hostname,
            port: Number(parsedUrl.port || '6379'),
            password: parsedUrl.password || undefined,
            db: Number.isNaN(database) ? 0 : database,
            ...(parsedUrl.protocol === 'rediss:' ? { tls: {} } : {}),
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    ProvidersModule,
    AuthModule,
    UsersModule,
    WalletModule,
    ServicesModule,
    OrdersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
