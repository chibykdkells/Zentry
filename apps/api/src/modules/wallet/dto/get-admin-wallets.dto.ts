import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole } from '@zendocx/types';

export class GetAdminWalletsQueryDto {
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
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
