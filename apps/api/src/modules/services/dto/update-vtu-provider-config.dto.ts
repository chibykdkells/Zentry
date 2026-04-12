import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateVtuProviderConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsIn(['AUTO', 'MOCK', 'LIVE'])
  rolloutMode?: 'AUTO' | 'MOCK' | 'LIVE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiKeyHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiKeyPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  healthPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  airtimePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dataPurchasePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dataPlansPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cablePlansPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cableVerifyPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cablePurchasePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  electricityVerifyPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  electricityPurchasePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
