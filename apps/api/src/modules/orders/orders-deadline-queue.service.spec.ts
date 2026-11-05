import { OrderStatus } from '@prisma/client';
import { OrdersDeadlineQueueService } from './orders-deadline-queue.service';
import {
  buildDeadlineJobId,
  DELIVERY_DEADLINE_JOB_NAME,
} from './delivery-deadline.constants';

describe('OrdersDeadlineQueueService', () => {
  let prisma: { order: { findMany: jest.Mock } };
  let deadlineQueue: { add: jest.Mock; getJob: jest.Mock };
  let service: OrdersDeadlineQueueService;

  beforeEach(() => {
    prisma = { order: { findMany: jest.fn() } };
    deadlineQueue = { add: jest.fn().mockResolvedValue(undefined), getJob: jest.fn() };
    service = new OrdersDeadlineQueueService(deadlineQueue as never, prisma as never);
  });

  it('rebuilds timers for claimed orders from their stored deadline', async () => {
    const future = new Date(Date.now() + 30 * 60 * 1000);
    prisma.order.findMany.mockResolvedValue([{ id: 'order-1', deliveryDeadline: future }]);

    await expect(service.schedulePendingDeadlines()).resolves.toEqual({ checked: 1, overdue: 0 });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS] },
        }) as unknown,
      }),
    );
    const [name, data, opts] = deadlineQueue.add.mock.calls[0] as [string, unknown, { delay: number; jobId: string }];
    expect(name).toBe(DELIVERY_DEADLINE_JOB_NAME);
    expect(data).toEqual({ orderId: 'order-1' });
    expect(opts.jobId).toBe(buildDeadlineJobId('order-1'));
    expect(opts.delay).toBeGreaterThan(29 * 60 * 1000);
  });

  it('fires overdue timers immediately instead of dropping them', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: 'order-2', deliveryDeadline: new Date(Date.now() - 5 * 60 * 1000) },
    ]);

    await expect(service.schedulePendingDeadlines()).resolves.toEqual({ checked: 1, overdue: 1 });
    const [, , opts] = deadlineQueue.add.mock.calls[0] as [string, unknown, { delay: number }];
    expect(opts.delay).toBe(0);
  });

  it('keeps scheduleDeadline ignoring deadlines already in the past', async () => {
    await service.scheduleDeadline('order-3', new Date(Date.now() - 1000));
    expect(deadlineQueue.add).not.toHaveBeenCalled();
  });

  it('does not stop startup when the database is unavailable', async () => {
    prisma.order.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
