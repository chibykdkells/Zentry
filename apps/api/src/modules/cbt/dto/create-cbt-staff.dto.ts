import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateCbtStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10–15 digits' })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
