import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FulfillmentType, OrderStatus, UserRole } from '@zentry/types';

export const adminOrderReleaseStates = [
  'AWAITING_WINDOW',
  'READY_FOR_RELEASE',
  'RELEASED',
] as const;

export type AdminOrderReleaseState = (typeof adminOrderReleaseStates)[number];

export class GetAdminOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(FulfillmentType)
  fulfillmentType?: FulfillmentType;

  @IsOptional()
  @IsEnum(UserRole)
  requesterRole?: UserRole;

  @IsOptional()
  @IsIn(adminOrderReleaseStates)
  releaseState?: AdminOrderReleaseState;
}
