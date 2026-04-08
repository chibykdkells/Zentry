import { IsString, MaxLength } from 'class-validator';

export class UpdateAdminOrderNotesDto {
  @IsString()
  @MaxLength(1000)
  adminNotes: string;
}
