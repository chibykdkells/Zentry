import { IsString, MinLength } from 'class-validator';

export class GetAdminFundingReconciliationPreviewDto {
  @IsString()
  @MinLength(1)
  reference: string;
}

export class ApplyAdminFundingReconciliationDto {
  @IsString()
  @MinLength(1)
  reference: string;
}
