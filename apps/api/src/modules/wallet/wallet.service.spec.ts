import { PaymentGateway, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
    wallet: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let paymentService: {
    gatewayName: string;
    initiatePayment: jest.Mock;
    verifyPayment: jest.Mock;
  };
  let notificationsService: {
    broadcastWalletUpdated: jest.Mock;
  };
  let emailService: Record<string, never>;
  let service: WalletService;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.zendocx.net';

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    paymentService = {
      gatewayName: PaymentGateway.FINTAVAPAY,
      initiatePayment: jest.fn(),
      verifyPayment: jest.fn(),
    };

    notificationsService = {
      broadcastWalletUpdated: jest.fn(),
    };
    emailService = {};

    service = new WalletService(
      prisma as never,
      paymentService as never,
      notificationsService as never,
      emailService as never,
    );
  });

  afterAll(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('uses the current frontend origin for the funding callback url', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      wallet: {
        id: 'wallet-1',
        availableBalance: 0n,
      },
    });
    prisma.transaction.create.mockResolvedValue({});
    prisma.transaction.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    paymentService.initiatePayment.mockResolvedValue({
      paymentUrl: 'https://fintavapay.com/checkout/test-ref',
      reference: 'txn-ref-1',
      gatewayRef: 'gateway-ref-1',
      mode: 'live',
    });

    await service.initiateFunding(
      'user-1',
      { amountNaira: 2500 },
      'https://zendocx.net',
    );

    expect(paymentService.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackUrl: 'https://zendocx.net/wallet',
      }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            callbackUrl: 'https://zendocx.net/wallet',
          }),
        }),
      }),
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            callbackUrl: 'https://zendocx.net/wallet',
          }),
        }),
      }),
    );
  });

  it('falls back to FRONTEND_URL when the request origin is missing or invalid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      wallet: {
        id: 'wallet-1',
        availableBalance: 0n,
      },
    });
    prisma.transaction.create.mockResolvedValue({});
    prisma.transaction.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    paymentService.initiatePayment.mockResolvedValue({
      paymentUrl: 'https://fintavapay.com/checkout/test-ref',
      reference: 'txn-ref-2',
      gatewayRef: 'gateway-ref-2',
      mode: 'live',
    });

    await service.initiateFunding(
      'user-1',
      { amountNaira: 1000 },
      'notaurl',
    );

    expect(paymentService.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackUrl: 'https://app.zendocx.net/wallet',
      }),
    );
  });

  it('records the selected payment gateway on successful funding init', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      wallet: {
        id: 'wallet-1',
        availableBalance: 0n,
      },
    });
    prisma.transaction.create.mockResolvedValue({});
    prisma.transaction.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    paymentService.initiatePayment.mockResolvedValue({
      paymentUrl: 'https://fintavapay.com/checkout/test-ref',
      reference: 'txn-ref-3',
      gatewayRef: 'gateway-ref-3',
      mode: 'live',
    });

    const result = await service.initiateFunding(
      'user-1',
      { amountNaira: 1000 },
      'https://zendocx.net',
    );

    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reference: expect.any(String) },
        data: expect.objectContaining({
          gateway: PaymentGateway.FINTAVAPAY,
          gatewayRef: 'gateway-ref-3',
        }),
      }),
    );
    expect(result.data.status).toBe(TransactionStatus.PENDING);
    expect(result.data.gateway).toBe(PaymentGateway.FINTAVAPAY);
    expect(result.data.amountNaira).toBe(1000);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.WALLET_FUNDING,
        }),
      }),
    );
  });

  it('previews a funding reference as eligible when gateway verification matches', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      walletId: 'wallet-1',
      userId: 'user-1',
      type: TransactionType.WALLET_FUNDING,
      status: TransactionStatus.PENDING,
      amount: 10000n,
      reference: 'ZDX-TXN-123',
      gateway: PaymentGateway.FINTAVAPAY,
      gatewayRef: 'gateway-ref-1',
      metadata: {
        callbackUrl: 'https://zendocx.net/wallet',
        checkoutMode: 'live',
      },
      createdAt: new Date('2026-05-04T18:00:00.000Z'),
      wallet: {
        id: 'wallet-1',
        availableBalance: 0n,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: UserRole.INDIVIDUAL,
        tenantId: 'tenant-1',
      },
    });
    paymentService.verifyPayment.mockResolvedValue({
      success: true,
      amountKobo: 10000n,
      reference: 'ZDX-TXN-123',
      gatewayRef: 'gateway-ref-1',
      paidAt: new Date('2026-05-04T18:05:00.000Z'),
    });

    const result = await service.getAdminFundingReconciliationPreview('ZDX-TXN-123');

    expect(result.data.canApply).toBe(true);
    expect(result.data.reasons).toEqual([]);
    expect(result.data.transaction.callbackUrl).toBe('https://zendocx.net/wallet');
    expect(result.data.verification.success).toBe(true);
    expect(result.data.verification.amountKobo).toBe('10000');
  });

  it('blocks reconciliation preview when the verified amount does not match', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-2',
      walletId: 'wallet-1',
      userId: 'user-1',
      type: TransactionType.WALLET_FUNDING,
      status: TransactionStatus.PENDING,
      amount: 10000n,
      reference: 'ZDX-TXN-456',
      gateway: PaymentGateway.FINTAVAPAY,
      gatewayRef: 'gateway-ref-2',
      metadata: {
        callbackUrl: 'https://zendocx.net/wallet',
        checkoutMode: 'live',
      },
      createdAt: new Date('2026-05-04T18:10:00.000Z'),
      wallet: {
        id: 'wallet-1',
        availableBalance: 0n,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: UserRole.INDIVIDUAL,
        tenantId: 'tenant-1',
      },
    });
    paymentService.verifyPayment.mockResolvedValue({
      success: true,
      amountKobo: 15000n,
      reference: 'ZDX-TXN-456',
      gatewayRef: 'gateway-ref-2',
      paidAt: new Date('2026-05-04T18:11:00.000Z'),
    });

    const result = await service.getAdminFundingReconciliationPreview('ZDX-TXN-456');

    expect(result.data.canApply).toBe(false);
    expect(result.data.reasons).toContain(
      'The provider confirmed a different amount than the pending wallet funding record.',
    );
  });
});
