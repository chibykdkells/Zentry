import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const adminDisputeActions = [
  'UNDER_REVIEW',
  'RESOLVED_FOR_REQUESTER',
  'RESOLVED_FOR_CBT',
  'REQUEST_REDO',
  'COMPLETE_MANUAL_REFUND',
  'EXECUTE_CBT_PENALTY',
  'WAIVE_CBT_PENALTY',
] as const;

export type AdminDisputeAction = (typeof adminDisputeActions)[number];

export class ReviewDisputeDto {
  @IsIn(adminDisputeActions)
  action!: AdminDisputeAction;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;

  @IsOptional()
  @IsBoolean()
  flagCbtPenalty?: boolean;
}
