import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../providers/providers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantResolverService } from './tenant-resolver.service';

@Module({
  imports: [PrismaModule, RedisModule, ProvidersModule],
  controllers: [TenantController],
  providers: [TenantService, TenantResolverService],
  exports: [TenantService, TenantResolverService],
})
export class TenantModule {}
