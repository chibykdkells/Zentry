import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  serviceId: string;

  @IsObject()
  submittedData: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requesterDocUrls?: string[];
}
