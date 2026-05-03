import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ServiceDeliveryMode } from '@zendocx/types';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  categoryId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug: string;

  @IsEnum(ServiceDeliveryMode)
  deliveryMode: ServiceDeliveryMode;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercent: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerServiceCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
