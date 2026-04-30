import { IsNumber, Max, Min } from 'class-validator';
import { InitiateWalletFundingSchema } from '@zendocx/validators';

export class InitiateWalletFundingDto {
  static schema = InitiateWalletFundingSchema;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Enter a valid funding amount' },
  )
  @Min(100, { message: 'Minimum funding amount is ₦100' })
  @Max(5000000, {
    message: 'Maximum funding amount per funding request is ₦5,000,000',
  })
  amountNaira: number;
}
