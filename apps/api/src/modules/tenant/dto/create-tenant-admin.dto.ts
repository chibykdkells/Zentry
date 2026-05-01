import { z } from 'zod';
import { TENANT_ADMIN_PERMISSIONS } from '@zendocx/types';

export const CreateTenantAdminSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  permissions: z.array(z.enum(TENANT_ADMIN_PERMISSIONS)).optional(),
});

export type CreateTenantAdminDto = z.infer<typeof CreateTenantAdminSchema>;
