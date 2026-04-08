import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WithdrawalStatus } from '@prisma/client';

export class ReviewWithdrawalRequestDto {
  @IsEnum(WithdrawalStatus)
  status!: WithdrawalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  gatewayRef?: string;
}
