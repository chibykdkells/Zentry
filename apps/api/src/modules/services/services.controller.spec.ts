import { ServicesController } from './services.controller';

describe('ServicesController', () => {
  it('uses the resolved tenant context for the public catalog when no user is attached', () => {
    const servicesService = {
      getCatalog: jest.fn(),
    };
    const controller = new ServicesController(servicesService as never);

    controller.getCatalog(
      { search: 'jamb' },
      undefined,
      { id: 'tenant-1' },
    );

    expect(servicesService.getCatalog).toHaveBeenCalledWith(
      { search: 'jamb' },
      'tenant-1',
    );
  });

  it('prefers the authenticated user tenant id over the resolved tenant context', () => {
    const servicesService = {
      getCatalog: jest.fn(),
    };
    const controller = new ServicesController(servicesService as never);

    controller.getCatalog(
      {},
      { tenantId: 'tenant-from-user' } as never,
      { id: 'tenant-from-request' },
    );

    expect(servicesService.getCatalog).toHaveBeenCalledWith(
      {},
      'tenant-from-user',
    );
  });
});
