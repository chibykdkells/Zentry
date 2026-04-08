import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteCbtJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cbtNotes?: string;
}
