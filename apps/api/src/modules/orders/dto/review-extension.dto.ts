import { IsEnum, IsInt, Max, Min, ValidateIf } from 'class-validator';

export enum ExtensionReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewExtensionDto {
  @IsEnum(ExtensionReviewAction)
  action: ExtensionReviewAction;

  @ValidateIf(
    (o: ReviewExtensionDto) => o.action === ExtensionReviewAction.APPROVE,
  )
  @IsInt()
  @Min(1)
  @Max(120)
  additionalMinutes: number;
}
