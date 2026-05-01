import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { TENANT_ADMIN_PERMISSIONS } from '@zendocx/types';

export class CreateOwnTenantAdminDto {
  @IsString()
  @Length(1, 50)
  firstName!: string;

  @IsString()
  @Length(1, 50)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(7, 20)
  phone!: string;

  @IsOptional()
  @IsArray()
  @IsIn(TENANT_ADMIN_PERMISSIONS, { each: true })
  permissions?: string[];
}
