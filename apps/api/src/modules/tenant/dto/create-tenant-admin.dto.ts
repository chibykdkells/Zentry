import { z } from 'zod';

export const CreateTenantAdminSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
});

export type CreateTenantAdminDto = z.infer<typeof CreateTenantAdminSchema>;
