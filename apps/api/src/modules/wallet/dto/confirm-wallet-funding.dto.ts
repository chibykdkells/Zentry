import { IsString, MinLength } from 'class-validator';

export class ConfirmWalletFundingDto {
  @IsString()
  @MinLength(1)
  reference: string;
}
