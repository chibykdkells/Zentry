import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './modules/prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: jest.Mock };
  const res = () => ({ status: jest.fn() });

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('reports ok, the database and the deployed commit', async () => {
      process.env.GIT_SHA = 'abc123';
      const r = res();
      const report = await appController.health(r as never);
      expect(report).toEqual(
        expect.objectContaining({ status: 'ok', db: 'ok', gitSha: 'abc123' }),
      );
      expect(r.status).not.toHaveBeenCalled();
    });

    it('answers 503 when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      const r = res();
      const report = await appController.health(r as never);
      expect(report).toEqual(expect.objectContaining({ status: 'degraded', db: 'error' }));
      expect(r.status).toHaveBeenCalledWith(503);
    });
  });
});
