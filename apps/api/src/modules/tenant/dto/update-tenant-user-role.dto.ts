import { IsEnum } from 'class-validator';
import { UserRole } from '@zendocx/types';

export class UpdateTenantUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
