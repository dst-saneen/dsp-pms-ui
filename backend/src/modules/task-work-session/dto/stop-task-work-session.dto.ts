import { IsUUID } from 'class-validator';

export class StopTaskWorkSessionDto {
  @IsUUID()
  employeeId: string;
}
