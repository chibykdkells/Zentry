import { z } from 'zod';

const nigerianPhoneRegex = /^(\+234|0)[789][01]\d{8}$/;

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const pinSchema = z
  .string()
  .length(6, 'PIN must be exactly 6 digits')
  .regex(/^\d{6}$/, 'PIN must contain only digits');

// ── Registration ────────────────────────────────────────────────

export const RegisterIndividualSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
    email: z.string().email('Invalid email address'),
    phone: z.string().regex(nigerianPhoneRegex, 'Invalid Nigerian phone number'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterIndividualInput = z.infer<typeof RegisterIndividualSchema>;

export const RegisterCbtSchema = RegisterIndividualSchema.innerType().extend({
  centerName: z.string().min(2, 'Center name must be at least 2 characters').max(100),
  licenseNumber: z.string().min(5, 'Invalid license number').max(50),
  address: z.string().min(10, 'Please provide a full address').max(255),
  state: z.string().min(2).max(50),
  lga: z.string().min(2).max(50),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterCbtInput = z.infer<typeof RegisterCbtSchema>;

// ── Auth flows ──────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/),
});

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

export const ResendOtpSchema = z.object({
  email: z.string().email(),
});

export type ResendOtpInput = z.infer<typeof ResendOtpSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ── PIN management ──────────────────────────────────────────────

export const SetPinSchema = z
  .object({
    pin: pinSchema,
    confirmPin: z.string(),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  });

export type SetPinInput = z.infer<typeof SetPinSchema>;

export const ChangePinSchema = z
  .object({
    currentPin: pinSchema,
    newPin: pinSchema,
    confirmPin: z.string(),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  })
  .refine((data) => data.currentPin !== data.newPin, {
    message: 'New PIN must be different from current PIN',
    path: ['newPin'],
  });

export type ChangePinInput = z.infer<typeof ChangePinSchema>;
