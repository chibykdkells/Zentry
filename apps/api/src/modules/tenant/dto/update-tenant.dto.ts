import { z } from 'zod';

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  tenantMarginRate: z.number().int().min(0).max(5000).optional(),
  customDomain: z.string().min(4).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
