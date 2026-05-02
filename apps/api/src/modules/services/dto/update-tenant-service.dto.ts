import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTenantServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

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
  tenantCommissionNaira?: number;

  @IsOptional()
  @IsArray()
  requiredFields?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  requiredDocuments?: Record<string, unknown>[];
}
