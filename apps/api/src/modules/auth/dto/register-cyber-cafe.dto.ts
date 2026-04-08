import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { RegisterCyberCafeSchema } from '@zentry/validators';
import { RegisterIndividualDto } from './register-individual.dto';

export class RegisterCyberCafeDto extends RegisterIndividualDto {
  static schema = RegisterCyberCafeSchema;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @IsString()
  @MinLength(10)
  @MaxLength(255)
  address: string;

  @IsString()
  state: string;

  @IsString()
  @IsOptional()
  cacNumber?: string;
}
