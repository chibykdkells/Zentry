import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const nigerianPhoneRegex = /^(\+234|0)[789][01]\d{8}$/;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(nigerianPhoneRegex, { message: 'Invalid Nigerian phone number' })
  phone?: string;
}
