import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ServiceDeliveryMode } from '@zentry/types';

function parseBooleanQuery(value: unknown): boolean | undefined | string {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return typeof value === 'string' ? value : undefined;
}

export class GetAdminServicesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsEnum(ServiceDeliveryMode)
  deliveryMode?: ServiceDeliveryMode;

  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  isActive?: boolean;
}
