import { PaymentGateway, TransactionStatus, TransactionType } from '@prisma/client';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      update: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
  };
  let paymentService: {
    gatewayName: string;
    initiatePayment: jest.Mock;
  };
  let notificationsService: Record<string, never>;
  let emailService: Record<string, never>;
  let service: WalletService;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.zendocx.net';

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    paymentService = {
      gatewayName: PaymentGateway.PAYSTACK,
      initiatePayment: jest.fn(),
    };

    notificationsService = {};
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
      paymentUrl: 'https://checkout.paystack.com/abc123',
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
      paymentUrl: 'https://checkout.paystack.com/abc123',
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
      paymentUrl: 'https://checkout.paystack.com/abc123',
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
          gateway: PaymentGateway.PAYSTACK,
          gatewayRef: 'gateway-ref-3',
        }),
      }),
    );
    expect(result.data.status).toBe(TransactionStatus.PENDING);
    expect(result.data.gateway).toBe(PaymentGateway.PAYSTACK);
    expect(result.data.amountNaira).toBe(1000);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.WALLET_FUNDING,
        }),
      }),
    );
  });
});
