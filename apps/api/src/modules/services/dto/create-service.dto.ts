import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsEnum(ServiceDeliveryMode)
  deliveryMode: ServiceDeliveryMode;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  platformFeeNaira: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalPriceNaira: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cbtCommissionNaira?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  providerCostNaira?: number;

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

  @IsOptional()
  @IsArray()
  requiredFields?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  requiredDocuments?: Record<string, unknown>[];
}
