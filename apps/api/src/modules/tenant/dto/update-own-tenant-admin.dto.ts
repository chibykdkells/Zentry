import { IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { TENANT_ADMIN_PERMISSIONS } from '@zendocx/types';

export class UpdateOwnTenantAdminDto {
  @IsOptional()
  @IsArray()
  @IsIn(TENANT_ADMIN_PERMISSIONS, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
