import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

const nigerianPhoneRegex = /^(\+234|0)[789][01]\d{8}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class RegisterIndividualDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @Matches(nigerianPhoneRegex, { message: 'Invalid Nigerian phone number' })
  phone: string;

  @IsString()
  @Matches(passwordRegex, {
    message:
      'Password must have 8+ chars, uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  confirmPassword: string;
}
