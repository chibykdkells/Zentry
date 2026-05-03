import { z } from 'zod';
import { TENANT_HOMEPAGE_TEMPLATES } from '@zendocx/types';

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
  homepageTemplate: z.enum(TENANT_HOMEPAGE_TEMPLATES).optional(),
  homepageHeading: z.string().trim().min(8).max(120).nullable().optional(),
  homepageSubheading: z.string().trim().min(12).max(220).nullable().optional(),
  homepageAbout: z.string().trim().min(24).max(900).nullable().optional(),
  homepageManualSteps: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(80),
        description: z.string().trim().min(6).max(220),
      }),
    )
    .max(4)
    .optional(),
});

export type UpdateOwnTenantSettingsDto = z.infer<
  typeof UpdateOwnTenantSettingsSchema
>;
