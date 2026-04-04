import { IsString, MinLength, MaxLength } from 'class-validator';
import { RegisterIndividualDto } from './register-individual.dto';

export class RegisterCbtDto extends RegisterIndividualDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  centerName: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  licenseNumber: string;

  @IsString()
  @MinLength(10)
  @MaxLength(255)
  address: string;

  @IsString()
  state: string;

  @IsString()
  lga: string;
}
