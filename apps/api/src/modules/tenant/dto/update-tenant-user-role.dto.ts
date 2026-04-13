import { IsEnum } from 'class-validator';
import { UserRole } from '@zentry/types';

export class UpdateTenantUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
