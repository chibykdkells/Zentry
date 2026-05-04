import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ApplyAdminOrderPricingRemediationDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds?: string[];

  @IsOptional()
  @IsBoolean()
  applyAllEligible?: boolean;
}
