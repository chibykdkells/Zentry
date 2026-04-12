import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be lowercase alphanumeric with hyphens only',
    ),
  logoUrl: z.string().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  tenantMarginRate: z.number().int().min(0).max(5000).optional(), // max 50%
  customDomain: z.string().min(4).optional(),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
