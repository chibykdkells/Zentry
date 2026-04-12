import { z } from 'zod';

export const UpdateOwnTenantSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  textColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  buttonColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  fontStyle: z.enum(['modern', 'classic', 'clean']).optional(),
  customDomain: z.string().trim().min(4).nullable().optional(),
});

export type UpdateOwnTenantSettingsDto = z.infer<
  typeof UpdateOwnTenantSettingsSchema
>;
