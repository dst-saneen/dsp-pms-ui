import { IsUUID } from 'class-validator';

export class CreateTaskWorkSessionDto {
  @IsUUID()
  workScheduleItemId: string;

  @IsUUID()
  employeeId: string;
}
