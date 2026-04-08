import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}
