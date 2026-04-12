import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const adminDisputeFinancialFollowUpActions = [
  'COMPLETE_MANUAL_REFUND',
  'EXECUTE_CBT_PENALTY',
  'WAIVE_CBT_PENALTY',
] as const;

export type AdminDisputeFinancialFollowUpAction =
  (typeof adminDisputeFinancialFollowUpActions)[number];

export class ReviewDisputeFinancialFollowUpDto {
  @IsIn(adminDisputeFinancialFollowUpActions)
  action!: AdminDisputeFinancialFollowUpAction;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
