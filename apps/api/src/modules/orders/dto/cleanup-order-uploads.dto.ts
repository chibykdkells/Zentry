import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';

export class CleanupOrderUploadsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  publicIds!: string[];
}
