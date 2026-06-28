import { IsUUID } from 'class-validator';

export class ReassignJobDto {
  @IsUUID()
  cbtId: string;
}
