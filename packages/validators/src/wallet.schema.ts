import { z } from 'zod';

export const InitiateWalletFundingSchema = z.object({
  amountNaira: z
    .number({
      invalid_type_error: 'Enter a valid funding amount',
      required_error: 'Funding amount is required',
    })
    .finite('Enter a valid funding amount')
    .min(100, 'Minimum funding amount is ₦100')
    .max(5000000, 'Maximum funding amount per funding request is ₦5,000,000'),
});

export type InitiateWalletFundingInput = z.infer<
  typeof InitiateWalletFundingSchema
>;

export const CreateWithdrawalRequestSchema = z.object({
  amountNaira: z
    .number({
      invalid_type_error: 'Enter a valid withdrawal amount',
      required_error: 'Withdrawal amount is required',
    })
    .finite('Enter a valid withdrawal amount')
    .min(100, 'Minimum withdrawal amount is ₦100')
    .max(5000000, 'Maximum withdrawal amount per request is ₦5,000,000'),
  bankName: z
    .string()
    .trim()
    .min(2, 'Bank name is required')
    .max(100, 'Bank name is too long'),
  bankCode: z
    .string()
    .trim()
    .min(2, 'Bank code is required')
    .max(20, 'Bank code is too long'),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Account number must be 10 digits'),
  accountName: z
    .string()
    .trim()
    .min(2, 'Account name is required')
    .max(120, 'Account name is too long'),
});

export type CreateWithdrawalRequestInput = z.infer<
  typeof CreateWithdrawalRequestSchema
>;
