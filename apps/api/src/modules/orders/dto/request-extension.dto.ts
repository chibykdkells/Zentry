import { IsString, MinLength, MaxLength } from 'class-validator';

export class RequestExtensionDto {
  @IsString()
  @MinLength(10, { message: 'Please provide a reason of at least 10 characters.' })
  @MaxLength(500)
  reason: string;
}
