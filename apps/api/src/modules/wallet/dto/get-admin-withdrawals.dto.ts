import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WithdrawalStatus } from '@prisma/client';

export class GetAdminWithdrawalsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
