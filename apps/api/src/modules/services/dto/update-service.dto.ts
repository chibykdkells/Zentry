import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ServiceDeliveryMode } from '@zendocx/types';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsEnum(ServiceDeliveryMode)
  deliveryMode?: ServiceDeliveryMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalPriceNaira?: number;

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

}
