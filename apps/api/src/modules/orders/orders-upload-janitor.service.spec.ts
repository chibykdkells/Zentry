/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { OrdersUploadJanitorService } from './orders-upload-janitor.service';

describe('OrdersUploadJanitorService', () => {
  let prisma: {
    uploadedOrderFile: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let storageService: {
    deleteFile: jest.Mock;
  };
  let service: OrdersUploadJanitorService;

  beforeEach(() => {
    prisma = {
      uploadedOrderFile: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    storageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrdersUploadJanitorService(
      prisma as never,
      storageService as never,
    );
  });

  it('deletes expired staged uploads and marks them as deleted', async () => {
    prisma.uploadedOrderFile.findMany.mockResolvedValue([
      {
        id: 'upload-1',
        publicId: 'orders/requesters/user-1/stale-1.pdf',
      },
      {
        id: 'upload-2',
        publicId: 'orders/requesters/user-2/stale-2.pdf',
      },
    ]);

    const result = await service.cleanupStaleUploads();

    expect(prisma.uploadedOrderFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: 'STAGED',
          expiresAt: {
            lte: expect.any(Date),
          },
        }),
      }),
    );
    expect(storageService.deleteFile).toHaveBeenNthCalledWith(
      1,
      'orders/requesters/user-1/stale-1.pdf',
    );
    expect(storageService.deleteFile).toHaveBeenNthCalledWith(
      2,
      'orders/requesters/user-2/stale-2.pdf',
    );
    expect(prisma.uploadedOrderFile.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'upload-1' },
      data: {
        state: 'DELETED',
        deletedAt: expect.any(Date),
      },
    });
    expect(prisma.uploadedOrderFile.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'upload-2' },
      data: {
        state: 'DELETED',
        deletedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      scannedCount: 2,
      removedCount: 2,
    });
  });
});
