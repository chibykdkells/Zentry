import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '@zendocx/types';

describe('AuthService', () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    wallet: {
      create: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    otpToken: {
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    cbtProfile: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let redis: {
    set: jest.Mock;
    del: jest.Mock;
    get: jest.Mock;
  };
  let jwt: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let config: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      wallet: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      otpToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      cbtProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    redis = {
      set: jest.fn(),
      del: jest.fn(),
      get: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          BCRYPT_ROUNDS: '4',
          PIN_BCRYPT_ROUNDS: '4',
          OTP_EXPIRY_MINUTES: '10',
          NODE_ENV: 'test',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };

        return values[key] ?? fallback;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          JWT_REFRESH_SECRET:
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        };

        return values[key];
      }),
    };

    const transactionClient = {
      user: {
        create: prisma.user.create,
        update: prisma.user.update,
      },
      wallet: prisma.wallet,
      auditLog: prisma.auditLog,
    };

    prisma.$transaction.mockImplementation(
      async (
        callback:
          | ((tx: typeof transactionClient) => Promise<unknown>)
          | Promise<unknown>[],
      ) => {
        if (typeof callback === 'function') {
          return await callback(transactionClient);
        }

        return Promise.all(callback);
      },
    );

    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'user@test.com',
      phone: '08012345678',
      role: UserRole.INDIVIDUAL,
      isEmailVerified: false,
      createdAt: new Date('2026-04-11T09:00:00.000Z'),
    });

    service = new AuthService(
      prisma as never,
      redis as never,
      jwt as never,
      config as never,
    );
  });

  it('scopes registration uniqueness checks to the current tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await service.registerIndividual(
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'User@Test.com',
        phone: '08012345678',
        password: 'Test@1234!',
        confirmPassword: 'Test@1234!',
      },
      'tenant-2',
    );

    expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        email: 'user@test.com',
        tenantId: 'tenant-2',
      },
    });
    expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        phone: '08012345678',
        tenantId: 'tenant-2',
      },
    });
  });

  it('rejects same-tenant email conflicts during registration', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing-user' });

    await expect(
      service.registerIndividual(
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'user@test.com',
          phone: '08012345678',
          password: 'Test@1234!',
          confirmPassword: 'Test@1234!',
        },
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects login when the email exists under a different tenant scope', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login('user@test.com', 'Test@1234!', 'other-tenant'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'user@test.com',
        tenantId: 'other-tenant',
      },
    });
  });
});
