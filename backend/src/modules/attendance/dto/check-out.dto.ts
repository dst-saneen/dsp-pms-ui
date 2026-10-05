import { IsOptional, IsUUID } from 'class-validator';

export class CheckOutDto {
  /** Optional admin override. Self-service derives employee from the session. */
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
