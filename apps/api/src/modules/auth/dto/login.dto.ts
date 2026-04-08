import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import {
  ChangePinSchema,
  ForgotPasswordSchema,
  LoginSchema,
  ResendOtpSchema,
  ResetPasswordSchema,
  SetPinSchema,
  VerifyOtpSchema,
} from '@zentry/validators';

export class LoginDto {
  static schema = LoginSchema;

  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;
}

export class VerifyOtpDto {
  static schema = VerifyOtpSchema;

  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  otp: string;
}

export class ResendOtpDto {
  static schema = ResendOtpSchema;

  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  static schema = ForgotPasswordSchema;

  @IsEmail({}, { message: 'Invalid email address' })
  email: string;
}

export class ResetPasswordDto {
  static schema = ResetPasswordSchema;

  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must have 8+ chars, uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  confirmPassword: string;
}

export class SetPinDto {
  static schema = SetPinSchema;

  @IsString()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'PIN must contain only digits' })
  pin: string;

  @IsString()
  confirmPin: string;
}

export class ChangePinDto {
  static schema = ChangePinSchema;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  currentPin: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  newPin: string;

  @IsString()
  confirmPin: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
