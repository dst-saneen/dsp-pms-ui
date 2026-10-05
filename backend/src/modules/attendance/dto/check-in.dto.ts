import { IsOptional, IsUUID } from 'class-validator';

export class CheckInDto {
  /** Optional admin override. Self-service derives employee from the session. */
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
