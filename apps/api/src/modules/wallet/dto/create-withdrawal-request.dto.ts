import {
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWithdrawalRequestDto {
  @IsNumber()
  @IsPositive()
  @Min(100)
  @Max(5_000_000)
  amountNaira!: number;

  @IsString()
  @MaxLength(100)
  bankName!: string;

  @IsString()
  @MaxLength(20)
  bankCode!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  accountNumber!: string;

  @IsString()
  @MaxLength(120)
  accountName!: string;
}
