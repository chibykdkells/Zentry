import {
  Controller,
  Get,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './modules/prisma/prisma.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  /** Commit the running image was built from (GIT_SHA build arg). */
  gitSha: string;
  db: 'ok' | 'error';
}

const DB_PING_TIMEOUT_MS = 3000;

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Used by the container healthcheck, the server's 5-minute health check and
   * the deploy pipeline (which waits until `gitSha` is the pushed commit).
   * Answers 503 when the database is unreachable so a broken API reads as
   * unhealthy instead of "ok".
   */
  @Public()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const db = await this.pingDatabase();
    if (db !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      gitSha: process.env.GIT_SHA || 'unknown',
      db,
    };
  }

  private async pingDatabase(): Promise<'ok' | 'error'> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), DB_PING_TIMEOUT_MS);
        }),
      ]);
      return 'ok';
    } catch {
      return 'error';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
